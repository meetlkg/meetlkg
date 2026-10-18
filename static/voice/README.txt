Recorded neural speech for the public Gokul portfolio

58 reply variants, generated offline with Kokoro-82M full precision and the am_fenrir voice. This is a synthetic voice, not a voice clone. The browser downloads only the selected MP3 and matching phoneme track; the source neural model is not shipped to visitors.

The source model and voice are Apache-2.0 licensed. Repositories and pinned revisions are recorded in manifest.json; a copy of the license is included. HeadTTS 1.3.0 (MIT, vendored separately) supplies phonemization and timing. The local decoder-duration patch matches round-to-even and clamp operations in the original Kokoro acoustic model:
https://github.com/hexgrad/kokoro/blob/main/kokoro/model.py

Audio: 24 kHz mono, 96 kbps gapless MP3. Timing: milliseconds, with 10 ms PCM-energy samples. MP3 encoder delay is trimmed; the build verifies the decoded length within 5 ms. Each synthesized chunk also checks waveform sample count against the rounded acoustic durations before inserted silences.

Rebuild with scripts/build-voice-pack.mjs. A voice file is tied to the full reply text; edits to profile.json or profile-knowledge.js need a new build. Test corpus coverage before serving an update. Raw synthesis and model weights stay outside the served repository.
