import type { IDataObject } from 'n8n-workflow';

export interface TtsCleaningOptions {
	removeUrls: boolean;
	removeImages: boolean;
	stripCodeBlocks: boolean;
	normalizeMentions: boolean;
	normalizeHashtags: boolean;
	ensureHeadingPunctuation: boolean;
}

export type TtsChunkStrategy = 'sentenceAware' | 'paragraphAware';

const HEADING_START = '__HSTART__';
const HEADING_END = '__HEND__';

function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(parseInt(num, 10)));
}

function normalizeNewlines(text: string): string {
	return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function isSetextUnderline(line: string): boolean {
	return /^\s{0,3}(=+|-+)\s*$/.test(line);
}

function isHeadingLine(line: string): boolean {
	return (
		/^\s{0,3}#{1,6}\s+\S/.test(line) ||
		/^\s*\[(?:h[1-6]|heading)\b/i.test(line) ||
		/^\s*<h[1-6]\b/i.test(line)
	);
}

function markHeadings(text: string): string {
	const lines = normalizeNewlines(text).split('\n');
	const output: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const current = lines[i];
		const next = lines[i + 1];

		if (current.trim() && typeof next === 'string' && isSetextUnderline(next)) {
			output.push(`${HEADING_START}${current.trim()}${HEADING_END}`);
			i += 1;
			continue;
		}

		if (isHeadingLine(current)) {
			output.push(`${HEADING_START}${current.trim()}${HEADING_END}`);
			continue;
		}

		output.push(current);
	}

	return output.join('\n');
}

function stripMarkup(text: string, options: TtsCleaningOptions): string {
	let output = text;

	output = output.replace(/<!--[\s\S]*?-->/g, '');
	output = output.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
	output = output.replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
	output = output.replace(/<br\s*\/?>/gi, '\n');
	output = output.replace(/<\/(p|div|h[1-6]|li|ul|ol|blockquote|pre|table|tr)>/gi, '\n');
	output = output.replace(/<[^>\n]+>/g, '');
	output = decodeHtmlEntities(output);

	if (options.stripCodeBlocks) {
		output = output.replace(/```[\s\S]*?```/g, '');
		output = output.replace(/~~~[\s\S]*?~~~/g, '');
		output = output.replace(/\[code[^\]]*][\s\S]*?\[\/code]/gi, '');
	} else {
		output = output.replace(/```/g, '');
		output = output.replace(/~~~/g, '');
		output = output.replace(/\[\/?code[^\]]*]/gi, '');
	}

	output = output.replace(/`([^`]*)`/g, '$1');

	output = output.replace(/!\[([^\]]*)]\([^)]+\)/g, (_, alt: string) => {
		if (options.removeImages) {
			return '';
		}
		return alt.trim();
	});
	output = output.replace(/\[img][\s\S]*?\[\/img]/gi, options.removeImages ? '' : ' image ');

	output = output.replace(/\[([^\]]+)]\(([^)]+)\)/g, (_m: string, label: string, url: string) => {
		const cleanLabel = label.trim();
		if (cleanLabel) {
			return cleanLabel;
		}
		return options.removeUrls ? '' : url.trim();
	});
	output = output.replace(/\[url=[^\]]*](.*?)\[\/url]/gis, '$1');
	output = output.replace(/\[url](.*?)\[\/url]/gis, '$1');

	output = output.replace(/(\*\*|__)(.*?)\1/gms, '$2');
	output = output.replace(/(\*|_)(.*?)\1/gms, '$2');
	output = output.replace(/~~(.*?)~~/gms, '$1');

	output = output.replace(/^\s{0,3}#{1,6}\s*/gm, '');
	output = output.replace(/[ \t]*#{1,}\s*$/gm, '');
	output = output.replace(/^\s{0,3}>\s?/gm, '');
	output = output.replace(/^\s{0,3}(?:[-*_]\s*){3,}\s*$/gm, '');
	output = output.replace(/^\s{0,3}[=-]{3,}\s*$/gm, '');

	output = output.replace(/^\s*\[\*]\s*/gm, '- ');
	output = output.replace(/\[\/?list[^\]]*]/gi, '');
	output = output.replace(/\[br\s*\/?]/gi, ' ');
	output = output.replace(/\[(?:\/?)[a-zA-Z][a-zA-Z0-9_-]*(?:=[^\]]+)?]/g, '');

	if (options.removeUrls) {
		output = output.replace(/\b(?:https?:\/\/|www\.)\S+\b/gi, '');
	}

	if (options.normalizeMentions) {
		output = output.replace(/(^|\s)@([a-zA-Z0-9_.-]+)/g, '$1$2');
	}

	if (options.normalizeHashtags) {
		output = output.replace(/(^|\s)#([a-zA-Z][a-zA-Z0-9_-]*)/g, '$1$2');
	}

	return decodeHtmlEntities(output);
}

function ensureHeadingEndingPunctuation(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		return '';
	}

	if (/[.!?:;]$/.test(trimmed)) {
		return trimmed;
	}

	return `${trimmed}.`;
}

function finalizeStructure(text: string, options: TtsCleaningOptions): string {
	const lines = normalizeNewlines(text)
		.split('\n')
		.map((line) => line.replace(/[ \t]+$/g, ''));

	const output: string[] = [];
	let paragraphBuffer: string[] = [];

	const flushParagraph = () => {
		if (paragraphBuffer.length === 0) {
			return;
		}
		const paragraph = paragraphBuffer.join(' ').replace(/\s+/g, ' ').trim();
		if (paragraph) {
			output.push(paragraph);
			output.push('');
		}
		paragraphBuffer = [];
	};

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) {
			flushParagraph();
			continue;
		}

		if (trimmed.includes(HEADING_START) && trimmed.includes(HEADING_END)) {
			flushParagraph();
			let heading = trimmed
				.replace(new RegExp(HEADING_START, 'g'), '')
				.replace(new RegExp(HEADING_END, 'g'), '')
				.trim();
			if (options.ensureHeadingPunctuation) {
				heading = ensureHeadingEndingPunctuation(heading);
			}
			if (heading) {
				output.push(heading);
				output.push('');
			}
			continue;
		}

		if (/^[-+*•]\s+/.test(trimmed) || /^\d{1,3}[.)]\s+/.test(trimmed)) {
			flushParagraph();
			output.push(trimmed);
			output.push('');
			continue;
		}

		paragraphBuffer.push(trimmed);
	}

	flushParagraph();

	while (output.length > 0 && output[output.length - 1] === '') {
		output.pop();
	}

	return output
		.join('\n')
		.replace(new RegExp(HEADING_START, 'g'), '')
		.replace(new RegExp(HEADING_END, 'g'), '')
		.replace(/[ \t]+/g, ' ')
		.replace(/[ \t]*\n[ \t]*/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

export function cleanTextForTts(input: string, options: TtsCleaningOptions): string {
	const withHeadingMarkers = markHeadings(input);
	const stripped = stripMarkup(withHeadingMarkers, options);
	return finalizeStructure(stripped, options);
}

function splitIntoSentences(text: string): string[] {
	const normalized = text.replace(/\s+/g, ' ').trim();
	if (!normalized) {
		return [];
	}

	const matches = normalized.match(/[^.!?]+(?:[.!?]+|$)/g);
	if (!matches) {
		return [normalized];
	}

	return matches.map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 0);
}

function forceChunk(value: string, maxChunkLength: number): string[] {
	const chunks: string[] = [];
	let index = 0;
	while (index < value.length) {
		chunks.push(value.slice(index, index + maxChunkLength).trim());
		index += maxChunkLength;
	}
	return chunks.filter((chunk) => chunk.length > 0);
}

function chunkLongParagraph(paragraph: string, maxChunkLength: number): string[] {
	const sentences = splitIntoSentences(paragraph);
	if (sentences.length === 0) {
		return forceChunk(paragraph, maxChunkLength);
	}

	const chunks: string[] = [];
	let current = '';

	for (const sentence of sentences) {
		if (sentence.length > maxChunkLength) {
			if (current) {
				chunks.push(current);
				current = '';
			}
			chunks.push(...forceChunk(sentence, maxChunkLength));
			continue;
		}

		if (!current) {
			current = sentence;
			continue;
		}

		const candidate = `${current} ${sentence}`;
		if (candidate.length <= maxChunkLength) {
			current = candidate;
			continue;
		}

		chunks.push(current);
		current = sentence;
	}

	if (current) {
		chunks.push(current);
	}

	return chunks;
}

export function chunkTtsText(
	text: string,
	maxChunkLength: number,
	strategy: TtsChunkStrategy,
): string[] {
	if (!text.trim()) {
		return [''];
	}

	if (maxChunkLength < 1) {
		return [text];
	}

	const units: string[] = [];
	if (strategy === 'paragraphAware') {
		const paragraphs = normalizeNewlines(text)
			.split(/\n{2,}/)
			.map((paragraph) => paragraph.trim())
			.filter((paragraph) => paragraph.length > 0);

		for (const paragraph of paragraphs) {
			if (paragraph.length <= maxChunkLength) {
				units.push(paragraph);
				continue;
			}

			units.push(...chunkLongParagraph(paragraph, maxChunkLength));
		}
	} else {
		const paragraphs = normalizeNewlines(text)
			.split(/\n{2,}/)
			.map((paragraph) => paragraph.trim())
			.filter((paragraph) => paragraph.length > 0);

		for (const paragraph of paragraphs) {
			const sentences = splitIntoSentences(paragraph);
			if (sentences.length === 0) {
				units.push(...forceChunk(paragraph, maxChunkLength));
				continue;
			}

			for (const sentence of sentences) {
				if (sentence.length <= maxChunkLength) {
					units.push(sentence);
				} else {
					units.push(...forceChunk(sentence, maxChunkLength));
				}
			}
		}
	}

	const chunks: string[] = [];
	let current = '';

	for (const unit of units) {
		if (!unit) {
			continue;
		}

		const separator = strategy === 'paragraphAware' ? '\n\n' : ' ';
		if (!current) {
			current = unit;
			continue;
		}

		const candidate = `${current}${separator}${unit}`;
		if (candidate.length <= maxChunkLength) {
			current = candidate;
			continue;
		}

		chunks.push(current);
		current = unit;
	}

	if (current) {
		chunks.push(current);
	}

	if (chunks.length === 0) {
		return [''];
	}

	return chunks;
}

export function buildTtsMetadataBlock(post: IDataObject, baseUrl?: string): string {
	const postId = Number(post.id ?? 0);
	const topicId = Number(post.topic_id ?? 0);
	const postNumber = Number(post.post_number ?? 0);
	const username = String(post.username ?? '').trim();
	const title = String(post.topic_title ?? post.title ?? '').trim();
	const createdAt = String(post.created_at ?? '').trim();

	const parts: string[] = [];
	if (title) {
		parts.push(`Topic: ${title}.`);
	}
	if (username) {
		parts.push(`Author: ${username}.`);
	}
	if (createdAt) {
		parts.push(`Created: ${createdAt}.`);
	}

	const normalizedBaseUrl = (baseUrl ?? '').trim().replace(/\/+$/, '');
	if (normalizedBaseUrl && topicId > 0 && postNumber > 0) {
		parts.push(`Link: ${normalizedBaseUrl}/t/${topicId}/${postNumber}.`);
	} else if (normalizedBaseUrl && postId > 0) {
		parts.push(`Link: ${normalizedBaseUrl}/p/${postId}.`);
	}

	return parts.join(' ').trim();
}
