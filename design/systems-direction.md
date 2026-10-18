# Direction 02 — Graphite / systems-first

A different theme and information architecture for Gokul's personal portfolio. Local preview: `/systems-portfolio.html`.

## Theme

Graphite, chalk and restrained acid-lime. Bold sans-serif identity, compact technical labels, flat surfaces and thin rules. A persistent profile rail anchors the desktop page; mobile uses a short chapter navigation. The system map is a conceptual illustration, with highlights tied to the selected specialty. It does not simulate live agent activity.

## Structure

1. **Focus:** name, professional positioning and an interactive choice between LLM systems, agent architecture and evaluation/delivery. Each choice links directly to relevant work.
2. **Selected systems:** an expandable index of LaunchAI, Plena and Accenture work. Each entry distinguishes scope, own contribution and outcome. The career progression is a compact technical lineage at the end of this chapter.
3. **In public:** a prominent small-model talk, then public tools/projects.
4. **Meet Gokul:** a dedicated light portrait sheet with the large centered 3D avatar, followed by hockey, community and the founder/engineering story. The avatar loads near this section. Conversation links to the existing working chat section.
5. **Contact:** one direct invitation, email and public profile links.

## Comparison

| Element | Direction 01 | Direction 02 |
| --- | --- | --- |
| Theme | Warm ivory, cobalt, serif accents | Graphite, lime, bold sans-serif |
| Navigation | Horizontal top navigation | Persistent identity/chapter rail |
| Opening | Centered message and portrait | Name, technical focus and system map |
| Work | Two long case-study articles | Expandable index of three selected systems |
| Career | Separate full timeline section | Technical lineage inside work |
| Public work | Project list and talk banner | Talk-led chapter with a project index |
| Avatar | Primary introduction | Large centered portrait in its own personal chapter |
| Flow | Personal introduction → work → thinking → career | Focus → systems → public work → person → contact |

Career facts and scoped outcomes continue to follow `static/profile.json` and the owner-supplied résumé. “10+ years” describes the overall product/engineering career, not ten years of LLM work. No research publications, fake agent activity, skill percentages or invented testimonials are introduced.

This is a separate local concept. It reuses the existing avatar renderer and changes neither the homepage nor the reconstruction pipeline. `systems-concept.png` is a design board, not a browser screenshot. The server, HTML, links and JavaScript can be checked locally; browser visual QA requires an available browser connection.
