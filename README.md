# gok03.com — The Intelligence Archipelago

A playable 3D portfolio for Gokulavasan Murali. Pilot a small agent between five floating islands, inspect career chapters and collect technical skill milestones. A conventional profile below the game keeps all career facts and contact links directly accessible.

## Preview

From this directory: `python3 -m http.server 8873 --bind 127.0.0.1`

Open http://localhost:8873/. No build step, package installation, API keys or backend.

## Interaction

- Choose an island or collection slot to send the agent there. Open its chapter and collect the skill.
- Desktop: select Enable keyboard, then WASD or arrows to move and E to discover nearby islands. Escape or Tab exits keyboard mode.
- Mobile: tap an island or collection slot. No joystick required.
- Motion toggle pauses ambient animation and makes island travel immediate. OS reduced-motion preference is respected.
- Discoveries persist only in localStorage on this browser; Reset journey clears them.
- A full HTML profile works without JavaScript. If WebGL is unavailable, chapter buttons still open the same career dossiers.

## Files

- `index.html`, `static/world.css`: game interface and readable profile
- `static/world.js`: travel, collectibles, keyboard input, dialogs, state and renderer lifecycle
- `static/world-models.js`: original procedural 3D islands, landmarks and agent avatar
- `static/profile-data.js`: resume-backed career chapters and public project descriptions
- `static/vendor/`: pinned Three.js 0.180.0, with MIT license, served locally
- `RESEARCH.md`: portfolio research and design rationale
- `archive.html`, `projects/`, `works.html`, `slm-talk/`: preserved earlier portfolio and project pages
- `CNAME`: existing custom domain configuration

Career facts, dates, roles and outcome metrics follow the owner-supplied Gokul.pdf resume. The PDF itself is not published. The game is a local portfolio exploration experience; its character is not a live AI service. There are no inference requests, simulated tool traces or fabricated model benchmark scores.

Publishing uses the repository’s existing hosting configuration. A preview does not change the live website.
