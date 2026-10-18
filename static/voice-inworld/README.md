# Gokul — prerecorded Inworld voice

50 conversational profile replies synthesized on 2026-10-18 using the owner's existing voice `dapper-honey-5958__gokul` and `inworld-tts-2`, with STABLE delivery. No voice cloning was performed in this build. Generated audio uses Inworld's service; no open-source license is asserted for these recordings or the voice identity.

- Source: [Inworld synthesis API](https://docs.inworld.ai/api-reference/ttsAPI/texttospeech/synthesize-speech).
- Mono 48 kHz, 128 kbps gapless MP3. All audio totals 12.94 MB; individual clips range from 31 to 388 KB. Only the selected reply downloads.
- Portfolio playback is audio only and muted by default. Speech-motion files are not loaded. The companion JSON is used to validate the voice, reply text and audio duration; it also retains Inworld's audio-derived OpenXR mouth-shape alignment, word timestamps and 10 ms PCM energy samples. OpenXR `ih`, `oh`, `ou` names map to the renderer's `I`, `O`, `U` poses. Timing version 3.
- Encoding preserves the source length within 5 ms, checked by decoding each finished MP3. Only uniform gain adjustment is applied; there is no time stretching or trimming that would shift alignment.
- Each filename is keyed by voice, model, complete answer and spoken text. The manifest covers every reachable curated answer, including short follow-ups and fallback replies.
- `SHA256SUMS` records hashes for the manifest, MP3s and timing JSONs.

Rebuild with `scripts/prepare-voice-corpus.mjs` then `scripts/build-inworld-voice.py` as described in the repository README. Credentials, build dependencies and raw WAV/API responses stay outside this directory and the served website. The browser only fetches these static assets; it never contacts Inworld.

The retained 40-clip facial-motion experiment uses `review-manifest.json` on `/avatar-check.html`; the portfolio player uses the 50-clip audio-only `manifest.json`.
