import { chapters, profile, projects } from './profile-data.js';

const $ = selector => document.querySelector(selector);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const panel = $('#avatar-chat-panel');
const compact = matchMedia('(max-width: 700px)');
const stage = $('.avatar-stage');
const stageHome = document.createComment('Central portrait position');
stage.before(stageHome);
let returnFocus;

function layoutConversation() {
  const modal = !panel.hidden && compact.matches;
  panel.setAttribute('role', modal ? 'dialog' : 'region');
  if (modal) panel.setAttribute('aria-modal', 'true');
  else panel.removeAttribute('aria-modal');
  document.querySelectorAll('main, .site-head, .site-footer').forEach(element => element.inert = modal);
  document.body.classList.toggle('chat-modal', modal);
  // Move the single live renderer above the mobile sheet; never duplicate it.
  if (modal) document.body.append(stage);
  else stageHome.after(stage);
}
function openChat(question = '', source = document.activeElement) {
  returnFocus = source;
  panel.hidden = false;
  document.body.classList.add('has-chat');
  layoutConversation();
  document.querySelectorAll('[data-open-chat]').forEach(button => button.setAttribute('aria-expanded', 'true'));
  if (question) $('#avatar-question').value = question;
  const portrait = $('#avatar-canvas');
  const rect = portrait.getBoundingClientRect();
  if (innerWidth > 700 && (rect.top < 0 || rect.bottom > innerHeight)) {
    portrait.scrollIntoView({ block: 'center', behavior: reduced.matches ? 'instant' : 'smooth' });
  }
  $('#avatar-question').focus({ preventScroll: true });
  document.dispatchEvent(new CustomEvent('portfolio:chat-open'));
}
function closeChat() {
  // Closing the conversation also cancels generation, recording and speech.
  document.dispatchEvent(new CustomEvent('portfolio:chat-close'));
  panel.hidden = true;
  document.body.classList.remove('has-chat');
  layoutConversation();
  document.querySelectorAll('[data-open-chat]').forEach(button => button.setAttribute('aria-expanded', 'false'));
  returnFocus?.focus({ preventScroll: true });
}
document.querySelectorAll('[data-open-chat]').forEach(button => button.addEventListener('click', () => openChat('', button)));
document.querySelectorAll('[data-chat-question]').forEach(button => button.addEventListener('click', () => openChat(button.dataset.chatQuestion, button)));
$('#chat-close').addEventListener('click', closeChat);
document.addEventListener('keydown', event => {
  if ($('#contact-card').open) return;
  if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); closeChat(); }
  if (event.key === 'Tab' && !panel.hidden && compact.matches) {
    const focusable = [...panel.querySelectorAll('button, textarea, select, a[href], [tabindex="0"]')].filter(element => !element.disabled && element.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
compact.addEventListener('change', layoutConversation);
// Preserve links from earlier portfolio previews to the conversation.
if (location.hash === '#avatar') openChat();
window.addEventListener('hashchange', () => { if (location.hash === '#avatar') openChat(); });

const topics = {
  vision: { icon: 'vision', kicker: 'COMPUTER VISION · EDGE ML', title: 'Small devices. Real-world decisions.', text: 'At Flytta, I built on-device YOLOv2 object detection for mobile estimates and LSTM anomaly detection on Raspberry Pi sensor streams.', question: 'What machine learning systems did you build at Flytta?' },
  language: { icon: 'brain', kicker: 'DEEP LEARNING · LANGUAGE SYSTEMS', title: 'From pixels to language to context.', text: 'At Pramati, I worked with LEGAL-BERT, knowledge graphs and audio-visual deep learning. At Accenture Labs, that grew into RAG, transformers and document intelligence.', question: 'Tell me about your deep learning and language work at Pramati.' },
  agents: { icon: 'robot', kicker: 'AGENTS · TOOLS · CONTEXT', title: 'Good agents need good teamwork.', text: 'At Plena Data, I architected a desktop sales platform with five specialized agents. At LaunchAI, I work on vision-first agents, context, tools and evaluation.', question: 'What have you built with multi-agent systems at Plena Data?' },
  models: { icon: 'models', kicker: 'SMALL MODELS · EVALUATION', title: 'A model doesn’t have to be enormous.', text: `I define small language and vision-language model evaluation at LaunchAI. ${projects.find(project => project.name === 'slm.expert').description} That’s what slm.expert helps people explore.`, question: 'What is slm.expert, and how does it help people discover small models?' },
  team: { icon: 'team', kicker: 'PRODUCT · ENGINEERING LEADERSHIP', title: 'The people behind the products.', text: 'I co-founded Flytta and scaled the company to 22 people. Later, I led 13 engineers at Plena Data, taking AI products from their first architecture through delivery.', question: 'Tell me about your engineering leadership at Plena Data.' },
  hockey: { icon: 'hockey', kicker: 'A LITTLE MORE HUMAN', title: 'Teamwork started on the field.', text: `My life includes ${profile.interests[0].charAt(0).toLowerCase() + profile.interests[0].slice(1)} I’ve also helped organize ${profile.community.join(', ')}.`, question: 'Tell me about your field hockey and community activities.' }
};
function animateStory(element) {
  if (reduced.matches) return;
  element.classList.remove('story-arrive');
  void element.offsetWidth;
  element.classList.add('story-arrive');
}
document.querySelectorAll('[data-topic]').forEach(button => button.addEventListener('click', () => {
  const story = topics[button.dataset.topic];
  document.querySelectorAll('[data-topic]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  $('#discovery-art').setAttribute('href', `static/world-icons.svg#${story.icon}`);
  $('#discovery-kicker').textContent = story.kicker;
  $('#discovery-title').textContent = story.title;
  $('#discovery-text').textContent = story.text;
  $('#discovery-ask').dataset.chatQuestion = story.question;
  animateStory($('.discovery-copy'));
  const storyRect = $('#discovery').getBoundingClientRect();
  if (storyRect.bottom > innerHeight || storyRect.top < 0) $('#discovery').scrollIntoView({ block: 'nearest', behavior: reduced.matches ? 'instant' : 'smooth' });
}));

const chapterPresentation = {
  flytta: { title: 'Intelligence, out in the world.', metric: ['On-device', 'inference'], caption: 'YOLOv2 on mobile. LSTM anomaly detection on Raspberry Pi.', question: 'What did you build at Flytta with on-device machine learning?' },
  pramati: { title: 'Teaching systems to make connections.', metric: ['Language', 'vision'], caption: 'LEGAL-BERT, knowledge graphs and audio-visual deep learning.', question: 'Tell me about your language and vision work at Pramati.' },
  accenture: { title: 'From documents to low Earth orbit.', metric: ['Terabyte', 'scale'], caption: 'Data connectors alongside ML for language, documents and satellite systems.', question: 'What did you work on at Accenture Labs, including physics-informed ML?' },
  plena: { title: 'Five agents. One shared context.', metric: ['5 agents', '13 engineers'], caption: 'A multi-agent platform and the engineering team I led.', question: 'How did the five-agent sales platform at Plena Data work?' },
  launchai: { title: 'Agents that get to work.', metric: ['3 months', '2 weeks'], caption: 'Time to market through modular agent architecture.', question: 'What is your role at LaunchAI, and what did modular agent architecture change?' }
};
const chapterDiagrams = {
  flytta: [['vision', 'Camera'], ['brain', 'YOLOv2'], ['tools', 'Mobile estimate']],
  pramati: [['tools', 'Documents'], ['brain', 'LEGAL-BERT'], ['vision', 'Contract review']],
  accenture: [['models', 'Synthetic data'], ['brain', 'Physics-informed ML'], ['satellite', 'Orbit prediction']],
  plena: [['vision', 'Research'], ['brain', 'Enrichment'], ['chat', 'Outreach']],
  launchai: [['vision', 'See the desktop'], ['tools', 'Use tools'], ['shield', 'Check behavior']]
};
function uiIcon(name, className) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS(svg.namespaceURI, 'use');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.classList.add(className);
  use.setAttribute('href', `static/world-icons.svg#${name}`); svg.append(use); return svg;
}
function renderDiagram(id) {
  const nodes = [];
  chapterDiagrams[id].forEach(([icon, label], index) => {
    if (index) {
      nodes.push(uiIcon('arrow', 'diagram-arrow'));
    }
    const step = document.createElement('div');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `static/world-icons.svg#${icon}`);
    svg.setAttribute('aria-hidden', 'true'); svg.append(use);
    const caption = document.createElement('span'); caption.textContent = label;
    step.append(svg, caption); nodes.push(step);
  });
  $('#journey-diagram').replaceChildren(...nodes);
}
document.querySelectorAll('[data-chapter]').forEach(button => button.addEventListener('click', () => {
  const chapter = chapters.find(item => item.id === button.dataset.chapter);
  const presentation = chapterPresentation[chapter.id];
  document.querySelectorAll('[data-chapter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  $('#journey-role').textContent = `${chapter.company} · ${chapter.role} · ${chapter.year}`;
  $('#journey-story-title').textContent = presentation.title;
  $('#journey-summary').textContent = chapter.summary;
  $('#journey-detail').textContent = chapter.details.slice(0, 2).join(' ');
  renderDiagram(chapter.id);
  $('#journey-skills').replaceChildren(...chapter.skills.slice(0, 5).map(skill => {
    const tag = document.createElement('span'); tag.textContent = skill; return tag;
  }));
  if (chapter.id === 'launchai') {
    $('#journey-metric').replaceChildren(document.createTextNode(presentation.metric[0]), uiIcon('arrow-down', 'metric-arrow'), document.createTextNode(presentation.metric[1]));
  } else {
    $('#journey-metric').replaceChildren(...presentation.metric.map(text => {const line=document.createElement('span');line.className='metric-line';line.textContent=text;return line;}));
  }
  $('#journey-metric-caption').textContent = presentation.caption;
  $('#journey-ask').dataset.chatQuestion = presentation.question;
  animateStory($('#journey-story'));
}));

const portrait = $('#avatar-canvas');
const status = $('#world-portrait-status');
const updatePortraitStatus = () => {
  const ready = portrait.dataset.ready === 'true';
  if (ready) status.textContent = 'Move your cursor. I’ll follow your lead.';
  else if (portrait.dataset.failed === 'true') status.textContent = '3D couldn’t load. My photo and conversation are still here.';
};
new MutationObserver(updatePortraitStatus).observe(portrait, { attributes: true, attributeFilter: ['data-ready', 'data-failed'] });
updatePortraitStatus();
$('#year').textContent = new Date().getFullYear();

const contactCard = $('#contact-card');
let contactReturn;
const contactIntro=$('.contact-card-intro').innerHTML;
function openContact(source = document.activeElement, unresolved = false) {
  $('.contact-card-intro').innerHTML=unresolved?'There’s more to the story than my AI knows.<br>Reach me directly and let’s talk.':contactIntro;
  contactReturn = source;
  document.dispatchEvent(new CustomEvent('portfolio:chat-close'));
  if (!contactCard.open) contactCard.showModal();
}
document.querySelectorAll('[data-open-contact]').forEach(button => button.addEventListener('click', event => {event.preventDefault();openContact(button);}));
document.addEventListener('portfolio:contact', event => openContact(document.activeElement,!!event.detail?.unresolved));
$('.contact-close').addEventListener('click', () => contactCard.close());
contactCard.addEventListener('click', event => {
  const rect=contactCard.getBoundingClientRect();
  if(event.target===contactCard&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))contactCard.close();
});
contactCard.addEventListener('close',()=>contactReturn?.focus({preventScroll:true}));
if(location.hash==='#contact-card')openContact();

document.body.dataset.contentReady='true';
