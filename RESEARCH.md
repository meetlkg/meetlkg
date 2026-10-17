# Portfolio research and content direction

Career facts, dates, roles, skills and outcome figures follow the owner-supplied **Gokul.pdf** résumé. Existing project and talk pages provide additional public work references. The résumé attachment is not published by this change.

Six primary-source expert portfolios informed the content structure:

| Reference | Useful pattern | Adaptation for this site |
| --- | --- | --- |
| [Andrej Karpathy](https://karpathy.ai/) | Career milestones connected to specific technical outputs. | A career timeline connecting roles with work, skills and evidence. |
| [Chip Huyen](https://huyenchip.com/) | Clear production-AI positioning supported by practical tools and work. | A brief introduction followed by concrete systems and role-specific outcomes. |
| [Hamel Husain](https://hamel.dev/) | A recognizable specialty supported by useful technical material. | Give harnesses, evaluation and reliability explicit treatment in the final chapter. |
| [Simon Willison](https://simonwillison.net/guides/) | Practical guides and working tools demonstrate engineering judgment. | Show project details and technical decisions behind the selected work. |
| [swyx](https://swyx.io/about) | Visitor-intent navigation and progressively deeper biography. | Offer a direct career list alongside exploration, with contact and work easy to reach. |
| [Eugene Yan](https://eugeneyan.com/) | Selected prototypes and architecture writing support the headline expertise. | Link genuine public projects and the existing small-model talk; avoid invented private project links. |

## Final design direction

This is a **personal portfolio**, with Gokulavasan Murali’s name, existing personal photo, role and current work at the top. First-person writing, an About section, selected project contributions, a recent-first experience timeline, independent projects, a talk and personal background form the page structure. Email, LinkedIn and GitHub are directly accessible.

The visual direction remains restrained: warm ivory, charcoal, muted green, readable type and a small decorative 3D accent in About. Project dialogs provide additional depth. Discovery counters, collectible controls and game language have been removed. The 3D accent is deferred until it approaches the viewport and supports reduced motion.

Career facts and outcome metrics follow the supplied resume. Education, community and hockey background follow the earlier personal portfolio; the photo is an existing repository asset. No new employment claims, private project links, testimonials or model benchmark scores are invented.

## Browser-local avatar tooling

The chosen stack keeps rendering and inference on the visitor's device. Model files are downloaded only after an explicit click. A small portfolio knowledge base uses local keyword retrieval rather than an additional embedding model.

| Task | Choice and rationale | Primary source |
| --- | --- | --- |
| Lightweight 3D | Procedural Three.js bust; no neural reconstruction weights. Simplified jaw/viseme animation rather than a full face rig. | [Three.js](https://threejs.org/docs/) |
| GPU chat | SmolLM2-360M q4 with WebLLM, approximately 207 MB of weights. Smaller than Qwen2.5-0.5B's approximately 290 MB MLC artifact. | [SmolLM2 files](https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC/tree/main), [WebLLM](https://webllm.mlc.ai/docs/user/basic_usage.html) |
| CPU chat | SmolLM2-135M q8 through Transformers.js, approximately 137 MB. Enables typed questions at an HTTP IP address. Its weak instruction following requires a clearly labelled profile-excerpt fallback. | [SmolLM2-135M](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct) |
| Speech recognition | Whisper Tiny English q8, approximately 41 MB. Pinned to Transformers.js 3.8.1: the v4 runtime rejected the quantized decoder graph during browser testing. | [Whisper artifacts](https://huggingface.co/onnx-community/whisper-tiny.en/tree/main/onnx), [Transformers.js](https://huggingface.co/docs/transformers.js) |
| Voice and lip timing | Timestamped Kokoro-82M q8 through HeadTTS, approximately 92 MB plus a voice and dictionary. Supplies phoneme timing for local mouth animation. | [HeadTTS](https://github.com/met4citizen/HeadTTS), [Kokoro artifacts](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX-timestamped/tree/main/onnx) |

These sizes exclude runtime files, caches and working memory. The browser used for development exposes no usable WebGPU adapter, so real inference was exercised on the WASM path; GPU performance and Mac-specific behavior need verification on a supported device. Browser microphone access and WebGPU need HTTPS or localhost. HTTP Tailscale IP access remains usable for CPU text chat.

The avatar is a stylized representation based on the existing outdoor photo. It is not a photoreal image reenactment or a voice clone. A closer 3D likeness would require a separately authored, optimized, rigged GLB asset; it would not require a neural reconstruction model to run in every visitor's browser.
