---
name: python-ffmpeg
description: Expert guide to FFmpeg from Python for video/audio processing, encoding,
  streaming, and media manipulation.
allowed-tools: Read, Grep, Glob
model: haiku
version: 1.0.0
category: 11-developer-tools
tags: []
harness:
- claude-code
- opencode
---

# Python FFmpeg Skill

Use this skill for Python-driven FFmpeg work: encoding, filtering, audio processing, metadata probing, streaming, thumbnails, PyAV frame access, subprocess integration, and production troubleshooting.

## When to Use This Skill

Use when the user asks for tasks covered by the frontmatter triggers, especially implementation guidance, debugging, architecture choices, production hardening, or performance-sensitive decisions in this domain. Start from this orchestrator, then load the focused reference file that matches the requested detail level.

## Core Workflow

1. Choose the integration layer first: ffmpeg-python for readable filter graphs, subprocess for full CLI parity, PyAV for frame-level access, and moviepy only for simple edits.
2. Probe inputs before processing so codec, duration, resolution, FPS, audio streams, and metadata are known.
3. Preserve audio explicitly whenever a video filter is applied; filtered video streams do not automatically carry audio.
4. Select the output codec and acceleration path based on compatibility, compression, and deployment hardware.
5. Use overwrite/error-handling patterns consistently: `overwrite_output()` with ffmpeg-python or `-y` with subprocess, plus captured stderr for diagnostics.
6. For large media, stream frames or use temp files instead of reading all stdout or frames into memory.

## Key Gotchas

- Video filters commonly drop audio unless the audio stream is passed to `ffmpeg.output(...)` or copied explicitly.
- Subprocess pipes can deadlock if stdout/stderr are not drained or frame reads are not sized correctly.
- Windows paths are safest as `Path(...).as_posix()` or as subprocess argument-list entries, not hand-quoted command strings.
- CRF values are codec-specific: H.265 CRF 28 is roughly comparable to H.264 CRF 23.
- Hardware encoders trade compression efficiency for speed; validate availability before choosing NVENC, QSV, AMF, or VAAPI.

## Reference Map

- [references/ffmpeg-complete-recipes.md](references/ffmpeg-complete-recipes.md) - Full original recipe guide covering encoding, hardware acceleration, audio/audio filters, video filters, trimming, concatenation, streaming, probing, thumbnails, PyAV, subprocess patterns, common transformations, errors, and performance tips.
- [references/ffmpeg-advanced-patterns.md](references/ffmpeg-advanced-patterns.md) - Additional advanced FFmpeg patterns already maintained for this skill.

## Response Guidance

- Preserve the user's existing framework, library, and tooling choices unless there is a clear compatibility or performance reason to suggest an alternative.
- Give copy-pasteable code only for the exact task at hand; otherwise point to the relevant reference section.
- Call out tradeoffs, failure modes, and verification steps for production workflows.
- Prefer accessible, maintainable, measurable solutions over clever micro-optimizations.
