# gok03.com — Intelligence, made useful.

A minimal, interactive portfolio for Gokulavasan Murali. Editorial typography, an original chrome 3D sculpture, selected case studies and a resume-backed career timeline.

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

The same launcher works on Linux. To run the server without opening a browser, use `python3 scripts/preview.py --no-open`. No build step, package installation, API key or backend is needed beyond Python 3. Serve the site over HTTP; opening `index.html` directly will prevent the JavaScript modules from loading correctly.

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
