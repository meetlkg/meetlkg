# gok03.com — Gokulavasan Murali

A personal portfolio for Gokulavasan Murali, with selected work, experience, independent projects and a conversational 3D avatar. The avatar is a stylized, procedural bust based on the existing photo: dark hair, beard, sunglasses and a grey T-shirt. It is an AI representation, not a facial scan or a clone of Gokul’s voice.

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

The same launcher works on Linux. To run the server without opening a browser, use `python3 scripts/preview.py --no-open`. The portfolio itself requires only Python 3 and has no build step. Conversation additionally needs Ollama as described below. Serve the site over HTTP; opening `index.html` directly will prevent the JavaScript modules from loading correctly.

For access from another device over LAN or Tailscale, run `./start.command --bind 0.0.0.0 --no-open` and open `http://<server-ip>:8874/` on that device. Use the printed port if the default port was busy.

## Talk to the avatar

1. Install and open [Ollama for Mac](https://ollama.com/download/mac) on the **server running the portfolio**. Linux is also supported.
2. Run `ollama pull llama3.2:3b` once to download the default conversation model.
3. Run `./start.command` and open the **localhost** URL. Ask a question using the text box, a suggested question or “Talk to me.” Allow microphone access when you choose voice input.

The server sends the public profile facts from `static/profile.json` with each conversation. It uses the real local [Ollama chat API](https://docs.ollama.com/api/chat); there are no canned AI responses. No API key is required. To use another installed model or server, set `GOKUL_AVATAR_MODEL` and `GOKUL_OLLAMA_URL` in the server environment. The defaults are `llama3.2:3b` and `http://127.0.0.1:11434`. A missing model or unavailable service is shown honestly in the interface.

Voice input and spoken replies use the browser’s Web Speech APIs. [Speech recognition support varies, and some browsers send audio to their speech service](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition). Text chat stays available when voice input is unsupported. Voice is a browser voice, not Gokul’s recorded or cloned voice. The mouth movement is an approximate speaking animation, not phoneme-based lip synchronization. Audio starts only after a visitor opts into voice; listening ends after one question or when stopped.

Remote microphone access requires **HTTPS**. An HTTP Tailscale IP works for text chat. If your tailnet has HTTPS Serve enabled, run this on the portfolio server:

```bash
tailscale serve --bg http://127.0.0.1:8874
```

Use the HTTPS URL Tailscale prints. This stays inside your tailnet; it does not use Funnel. If Serve is disabled, a tailnet administrator needs to enable it using the link printed by Tailscale. Alternatively, run the site and Ollama on your Mac and use localhost.

Conversations are kept in browser memory for the current page only; the application does not save transcripts or audio. Text is passed to the configured model server. The endpoint checks origin, bounds request sizes/history, rate-limits requests and limits concurrent inference. It never executes tools or makes commitments for Gokul. Model answers can still be wrong; the UI discloses this and links to direct contact.

**Public hosting:** GitHub Pages can serve the portfolio and 3D avatar, but cannot run the Python conversation API. To make conversation work on `gok03.com`, host this server and its model behind HTTPS on that domain, or add a production backend with the same `/api/avatar/*` routes. Do not expose the raw Ollama port publicly. This branch does not change the live domain’s hosting.

## Interactions

- Open selected work to see my role, technical approach and outcomes.
- Expand the experience timeline, with the current role first.
- The decorative 3D accent loads near the About section and pauses offscreen. Its motion control and system reduced-motion preferences are supported.
- The avatar loads near its section, follows the pointer gently and has rotate/pause controls. Listening, thinking and speaking states respond to the actual conversation. Both 3D scenes pause offscreen or when the page is hidden.
- Chat supports follow-up questions, stopping a reply, starting over, microphone input and optional spoken responses. Nothing auto-plays on arrival.
- Career content, photo, project links and contact details remain readable without JavaScript or WebGL.

## Files

- `index.html`, `static/premium.css`: responsive editorial layout and complete HTML timeline
- `static/premium.js`: project dialogs, scroll reveals, lazy 3D loading and motion controls
- `static/sculpture.js`: procedural chrome geometry and local studio reflections
- `static/profile-data.js`: resume-backed project and career details
- `static/profile.json`: shared source of public facts for the website and AI avatar
- `static/avatar-scene.js`: locally rendered 3D bust with a movable jaw and head
- `static/avatar-chat.js`, `static/avatar.css`: conversation, speech and responsive avatar interface
- `scripts/avatar.py`: local Ollama API bridge and request limits
- `tests/test_avatar.py`: API validation, failure handling and private-file boundary checks; run `python3 -m unittest discover -s tests -v`
- `static/vendor/`: locally served Three.js 0.180.0 with MIT license
- `RESEARCH.md`: primary-source portfolio references and content rationale
- `archive.html`, `projects/`, `works.html`, `slm-talk/`: preserved earlier portfolio and project pages
- `CNAME`: existing custom domain configuration

Dates, roles and outcome metrics follow the owner-supplied Gokul.pdf resume. The personal photo comes from the existing repository; education, community and hockey background come from the earlier portfolio. The attachment itself is not published. Local conversation uses an installed model; no benchmark scores are fabricated. Publishing uses the repository’s existing hosting setup; local preview does not change the live site.
