# gok03.com — Intelligence, made useful.

A minimal, interactive portfolio for Gokulavasan Murali. Editorial typography, an original chrome 3D sculpture, selected case studies and a resume-backed career timeline.

## Preview

From this directory: `python3 -m http.server 8874 --bind 127.0.0.1`

Open http://localhost:8874/. No build step, package installation, API key or backend.

## Interactions

- Select a sculpture marker, numbered chapter control or case study to read a career story.
- Expand the career timeline to explore roles from edge ML through deep learning and agent architecture.
- Exploring a chapter records a subtle discovery marker, saved only in this browser’s localStorage. Reset discoveries clears it.
- The sculpture rotates gently and responds to pointer movement. Pause motion stops it; system reduced-motion preferences are respected, with explicit manual override available.
- Career content, project links and contact details remain readable in HTML without JavaScript or WebGL.

## Files

- `index.html`, `static/premium.css`: responsive editorial layout and complete HTML timeline
- `static/premium.js`: story dialogs, chapter discovery and motion controls
- `static/sculpture.js`: procedural chrome geometry, local studio reflections and interactive markers
- `static/profile-data.js`: resume-backed career chapters
- `static/vendor/`: locally served Three.js 0.180.0 with MIT license
- `RESEARCH.md`: primary-source portfolio references and content rationale
- `archive.html`, `projects/`, `works.html`, `slm-talk/`: preserved earlier portfolio and project pages
- `CNAME`: existing custom domain configuration

Dates, roles and outcome metrics follow the owner-supplied Gokul.pdf resume. The attachment itself is not published. No live AI service or fabricated benchmark scores are implied. Publishing uses the repository’s existing hosting setup; local preview does not change the live site.
