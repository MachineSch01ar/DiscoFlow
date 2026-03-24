import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.11.1", (api) => {
  api.decorateCookedElement(async (element) => {
    const audio = element.querySelector("audio");
    const jsonLink = element.querySelector("a.attachment[href$='.json']");
    if (!audio || !jsonLink) return;

    // Prevent double-processing
    if (element.dataset.audioSyncProcessed) return;
    element.dataset.audioSyncProcessed = "true";

    // Hide the raw JSON link
    jsonLink.style.display = "none";

    let alignment;
    try {
      const resp = await fetch(jsonLink.href);
      if (!resp.ok) return;
      const data = await resp.json();
      alignment = data.alignment || (data.characters ? data : null);
    } catch (err) {
      console.error("AudioSync fetch error:", err);
      return;
    }
    if (!alignment) return;

    const audioWords = parseAlignment(alignment);
    if (!audioWords.length) return;

    const domTokens = tokenizeDOM(element);
    if (!domTokens.length) return;

    const matches = alignTokens(audioWords, domTokens, 20); // window size 20 tokens
    wrapMatches(matches);

    console.log(
      `AudioSync: matched ${matches.length}/${audioWords.length} audio words; DOM tokens: ${domTokens.length}`
    );

    // Cache spans for fast highlighting
    const spans = Array.from(element.querySelectorAll(".speaking-word")).map(
      (el) => ({
        el,
        start: parseFloat(el.dataset.start),
        end: parseFloat(el.dataset.end),
      })
    );

    let isLooping = false;
    let rafId;

    const renderLoop = () => {
      if (audio.paused) {
        isLooping = false;
        return;
      }
      const t = audio.currentTime;
      for (let i = 0; i < spans.length; i++) {
        const s = spans[i];
        if (t >= s.start && t < s.end) {
          if (!s.el.classList.contains("active")) s.el.classList.add("active");
        } else {
          if (s.el.classList.contains("active")) s.el.classList.remove("active");
        }
      }
      rafId = requestAnimationFrame(renderLoop);
    };

    const startLoop = () => {
      if (!isLooping) {
        isLooping = true;
        renderLoop();
      }
    };

    audio.addEventListener("play", startLoop);
    audio.addEventListener("playing", startLoop);
    audio.addEventListener("timeupdate", startLoop);
    audio.addEventListener("pause", () => {
      isLooping = false;
      if (rafId) cancelAnimationFrame(rafId);
    });

    // Click-to-seek with small pre-roll
    element.addEventListener("click", (e) => {
      if (e.target.classList.contains("speaking-word")) {
        const t = parseFloat(e.target.dataset.start);
        if (!isNaN(t)) {
          audio.currentTime = Math.max(0, t - 0.04);
          audio.play();
        }
      }
    });
  }, { id: "tts-highlighter" });
});

// --- HELPERS ---

// Unicode-aware normalize: strip diacritics, keep letters/numbers, remove punctuation
function normalize(str) {
  return str
    .normalize("NFD") // decompose accents
    .replace(/[\u0300-\u036f]/g, "") // strip accent marks
    .replace(/['’‛´`]/g, "") // drop apostrophes if desired
    .replace(/[^\p{L}\p{N}]+/gu, "") // keep only letters/numbers (Unicode)
    .toLowerCase();
}

function parseAlignment(alignment) {
  const out = [];

  // Prefer word-level alignment if present
  if (Array.isArray(alignment.words)) {
    alignment.words.forEach((w) => {
      const text = w.text || w.word || w.token;
      const start =
        w.start ?? w.start_time ?? w.start_time_seconds ?? w.startTime;
      const end = w.end ?? w.end_time ?? w.end_time_seconds ?? w.endTime;
      if (
        text &&
        typeof start === "number" &&
        typeof end === "number" &&
        !Number.isNaN(start) &&
        !Number.isNaN(end)
      ) {
        out.push({ text, start, end, norm: normalize(text) });
      }
    });
    return out;
  }

  // Fallback: rebuild words from character-level alignment
  const chars = alignment.characters || [];
  const starts = alignment.character_start_times_seconds || [];
  const ends = alignment.character_end_times_seconds || [];

  let cur = "";
  let start = null;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (isWordChar(ch)) {
      if (start === null) start = starts[i];
      cur += ch;
    } else if (cur) {
      out.push({
        text: cur,
        start,
        end: ends[i - 1],
        norm: normalize(cur),
      });
      cur = "";
      start = null;
    }
  }
  if (cur) {
    out.push({
      text: cur,
      start,
      end: ends[ends.length - 1],
      norm: normalize(cur),
    });
  }
  return out;
}

function isWordChar(ch) {
  return /\p{L}|\p{N}/u.test(ch);
}

// Tokenize visible DOM text into word tokens
function tokenizeDOM(root) {
  const tokens = [];
  const rejectTags = new Set([
    "CODE",
    "PRE",
    "KBD",
    "BUTTON",
    "SCRIPT",
    "STYLE",
    "TEXTAREA",
    "INPUT",
    "SELECT",
    "OPTION",
  ]);

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (rejectTags.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (
          p.closest("a.attachment") ||
          p.closest("audio") ||
          p.closest(".onebox") ||
          p.closest(".lightbox-wrapper") ||
          p.closest(".spoiler")
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        if (p.offsetParent === null) return NodeFilter.FILTER_REJECT; // hidden
        return NodeFilter.FILTER_ACCEPT;
      },
    },
    false
  );

  let node;
  let globalIdx = 0;
  const wordRe = /[\p{L}\p{N}]+/gu;
  while ((node = walker.nextNode())) {
    const text = node.textContent;
    let m;
    while ((m = wordRe.exec(text)) !== null) {
      const raw = m[0];
      tokens.push({
        node,
        start: m.index,
        end: m.index + raw.length,
        raw,
        norm: normalize(raw),
        idx: globalIdx++,
      });
    }
  }
  return tokens;
}

// Align audio words to DOM tokens with a lookahead window
function alignTokens(audioWords, domTokens, windowSize = 20) {
  const matches = [];
  let i = 0; // audio
  let j = 0; // dom

  while (i < audioWords.length && j < domTokens.length) {
    const aw = audioWords[i];
    const dt = domTokens[j];

    if (aw.norm && aw.norm === dt.norm) {
      matches.push({ audio: aw, dom: dt });
      i++;
      j++;
      continue;
    }

    // Look ahead in DOM for this audio word
    let foundDom = -1;
    for (
      let k = 1;
      k <= windowSize && j + k < domTokens.length;
      k++
    ) {
      if (domTokens[j + k].norm === aw.norm) {
        foundDom = j + k;
        break;
      }
    }
    if (foundDom !== -1) {
      j = foundDom;
      continue;
    }

    // No match in window: treat audio word as ghost (skip it)
    i++;
  }
  return matches;
}

// Wrap matched DOM tokens with spans, per-node descending to keep offsets valid
function wrapMatches(matches) {
  const byNode = new Map();
  matches.forEach((m) => {
    const n = m.dom.node;
    if (!byNode.has(n)) byNode.set(n, []);
    byNode.get(n).push(m);
  });

  byNode.forEach((list, node) => {
    // Process matches in descending start order to preserve offsets
    list
      .sort((a, b) => b.dom.start - a.dom.start)
      .forEach(({ dom, audio }) => {
        const span = document.createElement("span");
        span.className = "speaking-word";
        span.dataset.start = audio.start;
        span.dataset.end = audio.end;
        span.textContent = node.data.slice(dom.start, dom.end);

        // Split and replace
        const after = node.splitText(dom.end);
        const middle = node.splitText(dom.start);
        middle.parentNode.replaceChild(span, middle);

        // Update node reference to the head fragment for subsequent wraps
        // (because we process descending, lower starts stay in 'node')
      });
  });
}