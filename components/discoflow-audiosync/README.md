[![Publish status](https://github.com/MachineSch01ar/DiscoFlow-AudioSync-Component/actions/workflows/publish-discoflow-audiosync.yml/badge.svg?branch=main)](https://github.com/MachineSch01ar/DiscoFlow-AudioSync-Component/actions/workflows/publish-discoflow-audiosync.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](./LICENSE.md)
[![Discourse theme component](https://img.shields.io/badge/discourse-theme_component-5865F2?style=flat-square&logo=discourse)](https://meta.discourse.org/)
[![Synced from DiscoFlow](https://img.shields.io/badge/source-DiscoFlow-blue?style=flat-square)](https://github.com/YOURNAME/DiscoFlow/tree/main/components/audio-sync-highlighter)

# DiscoFlow AudioSync

A Discourse theme component that highlights words in post content in sync with an attached audio file and alignment JSON.

## About this repository

This repository is a synced mirror of the source maintained in the main **DiscoFlow** monorepo.

- **Source of truth:** `DiscoFlow/components/discoflow-audiosync/`
- **Published repo:** this repository
- **Sync method:** GitHub Actions automatically publishes this component from the monorepo into this standalone Discourse-installable repository

Because this repository is generated from the monorepo, **please do not edit files here directly**. Manual changes made in this repo may be overwritten the next time the sync workflow runs.

## Install in Discourse

In your Discourse admin:

**Admin → Appearance → Themes & components → Components → Install → From a Git repository URL**

Then paste this repository’s URL.

After installation, attach the component to an active theme.

## What it does

This component looks for:

- an audio player in cooked post content
- a linked `.json` attachment containing timing/alignment data

When both are present, it:

- matches spoken words to visible post text
- wraps matched words in clickable spans
- highlights the currently spoken word during playback
- lets readers click a word to seek the audio to that point

## Usage requirements

For this component to work, a post must include both of the following at the **top of the post content**:

1. An embedded `.mp3` audio file
2. An embedded alignment `.json` file

We currently generate the alignment file with **ElevenLabs**.

Example:

```text
![narration|audio](upload://5vFRNDlncZTVjU5Lw6pLjjkP6yX.mp3)
[timestamps|attachment](upload://4WMwBl59GzmQBYJvIMC9OeYCD5W.json)
```

## Repository notes

This repo is intended to stay in the file structure expected by Discourse theme components, including files such as:

- `about.json`
- `common/common.scss`
- `javascripts/discourse/api-initializers/theme-initializer.gjs`
- `locales/en.yml`

## Contributing

Please open issues and pull requests in the main **DiscoFlow** repository, not here, unless you specifically want to discuss packaging or publishing problems with this mirror.

Main source repository:

- `https://github.com/MachineSch01ar/DiscoFlow`

Component source path in that repo:

- `components/discoflow-audiosync/`

## License

See `LICENSE`.