# Gokul's world — illustrated personal portfolio

Implemented locally on 18 October 2026 at the main `/` URL. The previous homepage is retained at `/portfolio-before-world.html`. This revision replaces the corporate-feeling hierarchy with a personal opening centered on the actual interactive 3D portrait.

## Primary references consulted

- [Bruno Simon](https://bruno-simon.com/): his own welcome describes a portfolio explored by driving around a 3D world. Adapted the principle that objects and exploration can introduce the person and their work. Our topic objects keep the content immediately accessible and require no game controls.
- [Josh W. Comeau](https://www.joshwcomeau.com/): a personal technical site with interactive explanations. His [Squash and Stretch article](https://www.joshwcomeau.com/animation/squash-and-stretch/) explains expressive SVG interactions. Applied subtle rotations, spring-like hover transforms and reduced-motion handling to original illustrations.
- [Dennis Snellenberg](https://dennissnellenberg.com/): a direct personal introduction, individual identity, recent work and contact. Used that short narrative as a reminder to foreground Gokul and specific work, rather than an agency's capabilities or service offering.

The research inspected primary page content; it did not include visual browser sessions. Seán Halpin's site returned no readable page content, so no interaction claims or design decisions depend on that reference. No third-party artwork, screenshots, site source or branding has been copied.

## Composition and behavior

1. **Meet Gokul.** A large greeting and one central 3D portrait occupy the first screen. Six original comic illustrations around it represent computer vision, language/deep learning, agents, small models, leadership and hockey. A speech bubble and a single conversation button invite exploration.
2. **Pick a curiosity.** Each topic updates a visible short story and prepares a question about the same public-profile facts. Topic selection does not download a model or submit a message.
3. **Connect the dots.** A five-stop illustrated timeline follows Flytta → Pramati → Accenture Labs → Plena Data → LaunchAI. Each stop updates the role, experience, skills, a conceptual icon flow, and a scoped outcome. The diagram is explanatory, not live agent telemetry.
4. **Things made.** Three illustrated project objects lead to existing public work; an informal talk poster links to Small Models, Big Impact.
5. **The human.** Field hockey, community organizing and education anchor the page in the person. Contact finishes with a social-profile popup and a separate option to speak to the AI guide.

The theme combines white and warm paper, lilac, peach and sage with self-hosted Bricolage Grotesque. Illustrations and action icons are code-native SVG symbols. Two font files total about 164 KB. The existing avatar assets remain the dominant initial download; the compact chat encoder loads when chat opens, and speech uses recordings generated offline with a neural voice.

## Conversation and model

The central renderer is owned by `portfolio-chat.js`. It receives the conversation state and continuous mouth shapes from `profile-voice.js` and `portrait-speech.js`, synchronized to recorded phoneme times and the audio device clock. Desktop chat appears beside the portrait. Mobile chat moves the same renderer above the conversation sheet and keeps the background inert. Closing chat stops audio and pending replies.

The public page supports cursor-follow only, with ±10° horizontal and ±4° vertical head movement, beard binding and synchronized depth sorting. Manual rotation is confined to the internal avatar review page. This remains the existing single-image OMG-Avatar-derived reconstruction with its retained usage restrictions.

A 17.45 MB q8 MiniLM encoder finds approved answers from the same public résumé facts used on the page. It is a semantic profile guide, not a generative LLM. Runtime/tokenizer bring cold chat initialization to about 29 MB, separately from the portrait. There are no model download buttons or implementation disclosures cluttering the chat. Speech uses prerecorded Kokoro Fenrir audio, loaded only for the selected reply. Audio download failures produce one brief operational message. The interface identifies the conversation as “Gokul’s AI guide.”

## Icon and contact review

- Shared 24px SVG actions replace mixed font arrows; external links point northeast, send points upward, infographic sequences point right, and time-to-market reduction points down on desktop.
- Selected curiosity objects use a checkmark; unselected objects use a plus. Close icons appear only on dismissible panels.
- The brain illustration now has two hemispheres, folded contours and a restrained neural connection motif.
- Non-sequential statistics (5 agents / 13 engineers) are stacked without a directional arrow.
- “Say hello” opens a native modal with LinkedIn, GitHub and email, public profile handles, focus return, Escape and backdrop dismissal.

## Verification

The actual live WebGL portrait and prerecorded neural audio are reviewed in the connected browser on 18 October 2026. The 58-clip library covers all curated answers and follow-up combinations. The root page uses the compact profile encoder and per-answer MP3 playback; the large dynamic generation experiment is kept outside the served repository. Audio generation uses full-precision Kokoro offline, and the durations are rounded exactly as the acoustic decoder does before phoneme timestamps are calculated. Every build checks waveform length against those frame counts. Mouth transitions prioritize M/B/P closure and use modest jaw and lip fields to reduce exaggerated expressions.

The automated suites cover asset geometry, profile retrieval, phoneme continuity, decoder rounding, playback cancellation, stale narration rejection and full voice-corpus coverage. Browser review covers replay, mute, Stop, follow-ups, reset and a single canvas on mobile. Screenshots are saved under `design/review/`. Browser state and timing checks verify playback and animation, but do not constitute subjective listening approval on the user’s Mac. The reconstruction’s inferred teeth and mouth interior remain limitations.
