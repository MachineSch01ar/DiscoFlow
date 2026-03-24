---
name: maintain-theme-component
description: Build, modify, or troubleshoot DiscoFlow Discourse theme components when work touches components/*, component about.json files, locales, install behavior, or published component mapping. Use for component implementation and component-local doc or metadata alignment; not for Discourse Extended node work.
---

# Maintain Theme Component

## Use this skill when

- The task touches `components/*`.
- The task changes component JavaScript, styles, install requirements, `about.json`, or locales.
- The task involves a standalone published or mirrored component repository or its publish workflow mapping.

## Research workflow

1. Research official Discourse theme-component sources before implementing or troubleshooting:
   - Meta Discourse theme-component topics
   - Discourse core on GitHub
2. Default references when relevant:
   - `about.json` authoring guide: `https://meta.discourse.org/t/theme-component-authoring-in-the-about-json-file/202925`
   - JavaScript Plugin API guide: `https://meta.discourse.org/t/using-the-pluginapi-in-site-customizations/41281`
3. Use current upstream patterns for `about.json`, file layout, and plugin API usage instead of memory.

## Implementation guardrails

- Treat `components/<slug>/` as the source of truth.
- When behavior, install requirements, UI behavior, or user-facing functionality changes, update that component's `README.md`, `about.json`, relevant `locales/*.yml`, and install or usage notes in the same change.
- Keep detailed install and behavior docs in the component-local `README.md`. Only update the root `README.md` when repo-wide catalog or orientation content changes.
- If a component has a standalone published or mirrored repository, never hand-edit the generated standalone repo directly.
- Keep badges, `about.json` links, published-repo references, and workflow mapping aligned with the real component slug and target repository.

## Done when

- The monorepo component source is correct.
- Component docs and metadata match the actual shipped behavior.
- Any related root catalog or publish-workflow references are updated when the component inventory or publication model changes.
