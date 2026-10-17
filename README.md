# gok03.com — Gokulavasan Murali

A personal portfolio for Gokulavasan Murali, with selected work, experience, independent projects and a conversational 3D avatar. The avatar is a photo-textured 2.5D portrait built from the existing outdoor photo. It preserves Gokul’s actual face, swept hair, beard, aviator sunglasses, smile and grey T-shirt. A shallow 3D mesh adds gentle parallax, head movement and speech-driven mouth deformation; it is not a reconstructed full head or a clone of his voice.

## Preview

### Run on a Mac

Install Python 3 if it is not already available, then run in Terminal:

```bash
git clone --branch refresh-portfolio https://github.com/meetlkg/meetlkg.git meetlkg-preview
cd meetlkg-preview
./start.command
```

The launcher opens the website in your default browser. You can also double-click `start.command` in Finder after cloning. Keep its Terminal window open; press Control+C to stop the preview.

It uses port 8874, or an available port if that one is busy. The printed URL is the correct address for that run. If you downloaded a ZIP and the launcher is not executable, run `chmod +x start.command` in its folder first.

The same launcher works on Linux. To run the server without opening a browser, use `python3 scripts/preview.py --no-open`. The portfolio itself requires only Python 3 and has no build step. Browser conversation downloads its models on request; optional server conversation needs Ollama as described below. Serve the site over HTTP; opening `index.html` directly will prevent the JavaScript modules from loading correctly.

For access from another device over LAN or Tailscale, run `./start.command --bind 0.0.0.0 --no-open` and open `http://<server-ip>:8874/` on that device. Use the printed port if the default port was busy.

## Talk to the avatar — entirely on your device

The default **On your device** mode renders the 3D avatar and runs chat, speech recognition and speech generation in the visitor’s browser. It does not call the Python conversation API, Ollama or a hosted AI service. The site works with static hosting, including GitHub Pages. First-time model downloads require a connection; downloads go to Hugging Face/CDN providers, while questions and audio stay in the local worker pipeline. Browser model caches may be evicted or unavailable, especially in private browsing or insecure contexts; offline operation is not guaranteed.

1. Open the portfolio, go to the avatar and click **Load chat**. Model loading is explicit and cancelable; no weights download on arrival.
2. Ask a question by typing or choosing a suggestion.
3. Optionally click **Enable voice** to load the local speech models. Then use **Talk to me**, allow microphone access and click **Finish question**. Recording stops automatically after 15 seconds. Stop/reset/page hiding releases microphone tracks and stops audio playback.

| Component | Browser implementation | Model download, excluding runtime and caches |
| --- | --- | --- |
| 3D avatar | Locally vendored Three.js, photo-textured relief | No neural-model download; reuses the homepage photo with two meshes and 8,064 triangles |
| Chat with GPU | [WebLLM 0.2.86](https://github.com/mlc-ai/web-llm), SmolLM2-360M-Instruct q4 | Approximately 207 MB for q4f16; selects q4f32 on adapters without shader-f16 |
| Chat without a GPU | [Transformers.js](https://huggingface.co/docs/transformers.js), SmolLM2-135M-Instruct q8, WASM | Approximately 137 MB; smaller model with more limited answer quality |
| Speech input | Whisper Tiny English q8, Transformers.js WASM worker | Approximately 41 MB |
| Speech output + mouth timing | [HeadTTS 1.3.0](https://github.com/met4citizen/HeadTTS), timestamped Kokoro-82M q8 | Approximately 92 MB, plus one voice and the English dictionary |

These are download sizes, not RAM requirements. GPU chat, graphics, speech models and worker memory coexist; runtime memory is higher. Small chat models can hallucinate or miss facts. Local retrieval selects public résumé context without an embedding model. A conservative lexical check replaces weakly grounded responses with visibly labelled public-profile excerpts; this is a heuristic, not a guarantee of factuality. Model output is displayed after this check. The UI discloses that answers may be wrong and links to direct contact.

WebGPU requires HTTPS or localhost. Without an accessible GPU, chat uses the smaller WASM model on the CPU, including at an HTTP IP address. **Microphone access still requires HTTPS or localhost.** Typed questions and generated audio do not require microphone access. On a Mac, run `./start.command` and use its localhost URL for the full experience; Chrome or Edge with GPU acceleration is the recommended first target. The setup does not require Node, Python AI packages or an API key on the visitor’s device.

Voice uses actual Kokoro inference, not browser `SpeechRecognition` or `speechSynthesis`, which may use vendor cloud services. HeadTTS phoneme timing supplies small mouth/jaw deformations to the photo-textured mesh. Rotation is limited to approximately ±13 degrees because the source is one frontal photo. The portrait uses its original lighting and expression, with 30 fps motion, a capped pixel ratio and no vertex-buffer updates while the mouth is at rest. It pauses offscreen and respects reduced motion. It is a 2.5D photo likeness, not a full ARKit rig, a head scan or a voice clone. Full side views would require additional reference photos and a separately modeled, rigged GLB.

### Optional preview-server chat

For the earlier server-backed experience, choose **On the preview server**, or open `/?chat=server#avatar`. That choice explicitly sends text to the local preview API and its installed Ollama model. Voice, if enabled, remains browser-local. The application never silently falls back from device inference to server inference.

Install [Ollama](https://ollama.com/download), run `ollama pull llama3.2:3b` on the portfolio server and start the preview as before. `GOKUL_AVATAR_MODEL`, `GOKUL_OLLAMA_URL` and `GOKUL_AVATAR_THREADS` configure the server; defaults are `llama3.2:3b`, `http://127.0.0.1:11434` and four CPU threads. Server requests have origin checks, rate limits and bounded context. The application does not persist transcripts or audio.

GitHub Pages cannot run the optional Python API. Its **On your device** mode needs only static hosting. Tailscale IP access remains available; no HTTPS Serve configuration is enabled by this change. To use the microphone remotely later, HTTPS will be necessary.

## Interactions

- Open selected work to see my role, technical approach and outcomes.
- Expand the experience timeline, with the current role first.
- The decorative 3D accent loads near the About section and pauses offscreen. Its motion control and system reduced-motion preferences are supported.
- The photo-based avatar loads near its section, follows the pointer gently and has limited rotate/pause controls. Listening, thinking and speaking states respond to the actual conversation. Both 3D scenes pause offscreen or when the page is hidden.
- Chat supports follow-up questions, stopping a reply, starting over, microphone input and optional spoken responses. Nothing auto-plays on arrival.
- Career content, photo, project links and contact details remain readable without JavaScript or WebGL.

## Files

- `index.html`, `static/premium.css`: responsive editorial layout and complete HTML timeline
- `static/premium.js`: project dialogs, scroll reveals, lazy 3D loading and motion controls
- `static/sculpture.js`: procedural chrome geometry and local studio reflections
- `static/profile-data.js`: resume-backed project and career details
- `static/profile.json`: shared source of public facts for the website and AI avatar
- `static/avatar-scene.js`: photo-textured relief mesh, hand-traced silhouette, subtle jaw deformation and head movement
- `static/avatar-chat.js`, `static/avatar.css`: explicit runtime selection, model loading, conversation and responsive avatar interface
- `static/browser-ai.js`, `static/browser-chat-worker.js`: local retrieval, WebLLM GPU inference and Transformers.js WASM fallback
- `static/browser-speech.js`, `static/browser-asr-worker.js`: Kokoro/Whisper workers, microphone lifecycle, audio playback and viseme timing
- `scripts/avatar.py`: local Ollama API bridge and request limits
- `tests/test_avatar.py`: API validation, failure handling and private-file boundary checks; run `python3 -m unittest discover -s tests -v`
- `tests/browser-ai.test.mjs`: generation cancellation, worker failure, microphone cleanup and grounded-profile fallback; run `node --test tests/browser-ai.test.mjs` with a current Node.js installation (development only)
- `static/vendor/`: locally served Three.js 0.180.0 (MIT), WebLLM 0.2.86 (Apache 2.0) and HeadTTS 1.3.0 (MIT), with license files
- `RESEARCH.md`: primary-source portfolio references and content rationale
- `archive.html`, `projects/`, `works.html`, `slm-talk/`: preserved earlier portfolio and project pages
- `CNAME`: existing custom domain configuration

Dates, roles and outcome metrics follow the owner-supplied Gokul.pdf resume. The personal photo comes from the existing repository; education, community and hockey background come from the earlier portfolio. The attachment itself is not published. Device conversation uses downloaded browser models; the optional preview-server mode uses an installed model. No benchmark scores are fabricated. Publishing uses the repository’s existing hosting setup; local preview does not change the live site.
