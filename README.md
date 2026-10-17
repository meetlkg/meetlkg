# gok03.com — Gokulavasan Murali

A personal portfolio for Gokulavasan Murali, centered on his introduction, existing personal photo, selected work, experience, independent projects and interests. A small decorative 3D accent sits in the About section.

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

For access from another device over LAN or Tailscale, run `./start.command --bind 0.0.0.0 --no-open` and open `http://<server-ip>:8874/` on that device. Use the printed port if the default port was busy.

## Interactions

- Open selected work to see my role, technical approach and outcomes.
- Expand the experience timeline, with the current role first.
- The decorative 3D accent loads near the About section and pauses offscreen. Its motion control and system reduced-motion preferences are supported.
- Career content, photo, project links and contact details remain readable without JavaScript or WebGL.

## Files

- `index.html`, `static/premium.css`: responsive editorial layout and complete HTML timeline
- `static/premium.js`: project dialogs, scroll reveals, lazy 3D loading and motion controls
- `static/sculpture.js`: procedural chrome geometry and local studio reflections
- `static/profile-data.js`: resume-backed project and career details
- `static/vendor/`: locally served Three.js 0.180.0 with MIT license
- `RESEARCH.md`: primary-source portfolio references and content rationale
- `archive.html`, `projects/`, `works.html`, `slm-talk/`: preserved earlier portfolio and project pages
- `CNAME`: existing custom domain configuration

Dates, roles and outcome metrics follow the owner-supplied Gokul.pdf resume. The personal photo comes from the existing repository; education, community and hockey background come from the earlier portfolio. The attachment itself is not published. No live AI service or fabricated benchmark scores are implied. Publishing uses the repository’s existing hosting setup; local preview does not change the live site.
