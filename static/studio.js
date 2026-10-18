const $ = (selector) => document.querySelector(selector);
const fields = [...document.querySelectorAll('[data-field]')];
const clone = (value) => structuredClone(value);
const state = { posts: [], current: null, dirty: false, busy: false, local: false, assets: [] };
const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
const blank = () => ({ title: '', slug: '', excerpt: '', summary: '', category: 'Field notes', tags: [], blocks: [{ type: 'paragraph', text: '' }], sources: [], related: [], faqs: [] });
let draft = blank();

async function api(path, payload) {
  const response = await fetch('/api/cms/' + path, {
    credentials: 'same-origin', cache: 'no-store',
    ...(payload === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== 'login') showLogin();
    throw new Error(data.error || 'The request could not be completed.');
  }
  return data;
}
function error(message = '') { $('#studio-error').textContent = message; $('#studio-error').hidden = !message; }
function status(message) { $('#save-state').textContent = message; }
function markDirty() { state.dirty = true; status('Unsaved changes'); updateStats(); }
function safeSwitch() { return !state.dirty || window.confirm('Discard the unsaved changes to this draft?'); }
function localTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : new Date(date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function postStatus(post) { return post.archived ? 'archived' : post.scheduledAt ? 'scheduled' : post.live ? 'published' : 'draft'; }
function el(tag, text, attrs = {}) {
  const node = document.createElement(tag); if (text != null) node.textContent = text;
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}
function button(label, handler, attrs = {}) {
  const node = el('button', label, { type: 'button', ...attrs }); node.addEventListener('click', handler); return node;
}
async function run(task) {
  if (state.busy) return;
  state.busy = true; error(); $('#editor-fields').inert = true;
  document.querySelectorAll('.editor-toolbar button, #new-post, .article-item').forEach(node => { node.disabled = true; });
  try { await task(); } catch (cause) { error(cause.message); status('Not saved — check the message below'); }
  finally {
    state.busy = false; $('#editor-fields').inert = false;
    document.querySelectorAll('.editor-toolbar button, #new-post, .article-item').forEach(node => { node.disabled = false; });
  }
}
function renderList() {
  const search = $('#post-search').value.toLowerCase(), filter = $('#post-filter').value;
  const list = $('#post-list'); list.replaceChildren();
  const records = state.posts.filter(p => (!filter || postStatus(p) === filter) && (p.draft.title + ' ' + p.draft.tags.join(' ')).toLowerCase().includes(search));
  for (const post of records) {
    const node = button('', () => { if (!state.busy && safeSwitch()) select(post); }, { class: 'article-item', 'aria-current': String(state.current?.id === post.id) });
    node.append(el('strong', post.draft.title), el('small', `${postStatus(post)} · ${new Date(post.updatedAt).toLocaleDateString()}`));
    list.append(node);
  }
  if (!records.length) list.append(el('p', 'No stories here yet.', { class: 'small-note' }));
}
function select(record = null) {
  state.current = record ? clone(record) : null; draft = record ? clone(record.draft) : blank(); state.dirty = false;
  error(); fillFields(); renderBlocks(); renderList();
  status(record ? (record.scheduleError ? 'Schedule needs attention: ' + record.scheduleError : record.scheduledAt ? 'Scheduled for ' + new Date(record.scheduledAt).toLocaleString() : 'Saved · ' + postStatus(record)) : 'A fresh page. Make it yours.');
}
function fillFields() {
  for (const node of fields) node.value = draft[node.dataset.field] || '';
  $('[data-field="slug"]').readOnly = Boolean(state.current?.live);
  $('#tags').value = (draft.tags || []).join(', ');
  for (const key of ['sources', 'related']) $('#' + key).value = (draft[key] || []).map(item => `${item.label} | ${item.url}`).join('\n');
  $('#faqs').value = (draft.faqs || []).map(item => `${item.question} | ${item.answer}`).join('\n');
  $('#published-at').value = localTime(draft.publishedAt); $('#schedule-at').value = localTime(state.current?.scheduledAt);
  const revisions = $('#revisions'); revisions.replaceChildren();
  (state.current?.revisions || []).forEach((revision, index) => revisions.prepend(el('option', new Date(revision.savedAt).toLocaleString() + ' — ' + revision.draft.title, { value: index })));
  if (!revisions.children.length) revisions.append(el('option', 'No saved revisions yet', { value: '' }));
  $('#restore-revision').disabled = !state.current?.revisions?.length;
  $('#cancel-schedule').hidden = !state.current?.scheduledAt;
  $('#unpublish').hidden = !state.current?.live;
  $('#archive').hidden = !state.current || state.current.archived;
  $('#restore-post').hidden = !state.current?.archived;
  $('#publish').textContent = state.current?.live ? 'Publish changes ↗' : 'Publish ↗';
  updateStats();
}
function linePairs(id, keys) {
  return $('#' + id).value.split('\n').filter(line => line.trim()).map((line, index) => {
    const separator = line.indexOf('|');
    if (separator < 1 || !line.slice(separator + 1).trim()) throw new Error(`${id}: line ${index + 1} needs two values separated by |.`);
    return { [keys[0]]: line.slice(0, separator).trim(), [keys[1]]: line.slice(separator + 1).trim() };
  });
}
function collect() {
  for (const node of fields) draft[node.dataset.field] = node.value.trim();
  draft.slug = draft.slug || slugify(draft.title);
  draft.tags = $('#tags').value.split(',').map(tag => tag.trim()).filter(Boolean);
  draft.sources = linePairs('sources', ['label', 'url']); draft.related = linePairs('related', ['label', 'url']); draft.faqs = linePairs('faqs', ['question', 'answer']);
  draft.publishedAt = $('#published-at').value ? new Date($('#published-at').value).toISOString() : '';
  return clone(draft);
}
function updateStats() {
  const text = draft.blocks.map(block => block.text || '').join(' ').trim();
  const words = text ? text.split(/\s+/).length : 0;
  $('#word-count').textContent = `${words} words · ${Math.max(1, Math.ceil(words / 220))} min read`;
  const title = $('[data-field="title"]').value;
  $('#seo-url').textContent = 'gok03.com › blog › ' + ($('[data-field="slug"]').value || slugify(title));
  $('#seo-title').textContent = $('[data-field="seoTitle"]').value || title || 'Your article title';
  $('#seo-description').textContent = $('[data-field="seoDescription"]').value || $('[data-field="excerpt"]').value || 'A clear, useful description of your article.';
  const checks = [
    [Boolean($('[data-field="summary"]').value.trim()), 'Clear summary for readers'],
    [Boolean($('[data-field="seoDescription"]').value || $('[data-field="excerpt"]').value), 'Search description'],
    [draft.blocks.some(block => block.type === 'heading'), 'Headings to navigate the article'],
    [Boolean($('#sources').value.trim()), 'Sources readers can follow'],
    [Boolean($('#related').value.trim()), 'Connections to your work'],
  ];
  $('#seo-checks').replaceChildren(...checks.map(([done, label]) => el('li', `${done ? '✓' : '○'} ${label}`)));
}
function blockField(container, block, key, label, tag = 'textarea', attrs = {}) {
  const wrapper = el('label', label), input = el(tag, null, attrs); input.value = block[key] || '';
  input.addEventListener('input', () => { block[key] = input.value; markDirty(); }); wrapper.append(input); container.append(wrapper); return input;
}
function renderBlocks() {
  const container = $('#blocks'); container.replaceChildren();
  draft.blocks.forEach((block, index) => {
    const card = el('div', null, { class: 'content-block' }), toolbar = el('div', null, { class: 'block-toolbar' });
    toolbar.append(el('span', `${index + 1} / ${block.type}`));
    for (const [label, delta] of [['↑', -1], ['↓', 1]]) {
      const control = button(label, () => { const target = index + delta; [draft.blocks[index], draft.blocks[target]] = [draft.blocks[target], draft.blocks[index]]; renderBlocks(); markDirty(); }, { 'aria-label': `Move ${block.type} ${delta < 0 ? 'up' : 'down'}` });
      control.disabled = index + delta < 0 || index + delta >= draft.blocks.length; toolbar.append(control);
    }
    toolbar.append(button('×', () => { draft.blocks.splice(index, 1); renderBlocks(); markDirty(); }, { 'aria-label': `Remove ${block.type} block ${index + 1}` })); card.append(toolbar);
    if (block.type === 'heading' || block.type === 'list') {
      const label = el('label', block.type === 'heading' ? 'Heading level' : 'List style'), select = el('select');
      const choices = block.type === 'heading' ? [['2', 'Section · H2'], ['3', 'Subsection · H3']] : [['false', 'Bullets'], ['true', 'Numbered']];
      select.append(...choices.map(([value, text]) => el('option', text, { value })));
      select.value = block.type === 'heading' ? String(block.level || 2) : String(Boolean(block.ordered));
      select.addEventListener('change', () => { if (block.type === 'heading') block.level = Number(select.value); else block.ordered = select.value === 'true'; markDirty(); }); label.append(select); card.append(label);
    }
    if (block.type === 'image') {
      blockField(card, block, 'url', 'Image URL', 'input', { placeholder: '/media/… or https://…' });
      blockField(card, block, 'alt', 'Alt text', 'input', { placeholder: 'Describe what this image shows' });
      blockField(card, block, 'caption', 'Caption', 'input');
      if (block.url && /^(https?:\/\/|\/media\/|\/static\/)/.test(block.url)) card.append(el('img', null, { class: 'image-preview', src: block.url.replace(/^\/media\//, '/api/cms/assets/'), alt: block.alt || '' }));
    } else if (block.type !== 'divider') {
      const hints = { table: 'Header one | Header two\nFirst value | Second value', list: 'One item per line', code: 'Paste your code here', heading: 'A useful section heading', paragraph: 'Start the conversation…' };
      blockField(card, block, 'text', block.type === 'table' ? 'Table (first row is the header)' : 'Content', 'textarea', { rows: block.type === 'heading' ? 2 : 4, placeholder: hints[block.type] || 'Write here…', class: block.type === 'code' ? 'code-input' : block.type === 'heading' ? 'heading-input' : '' });
      if (block.type === 'code') blockField(card, block, 'language', 'Language', 'input', { placeholder: 'Python' });
      if (block.type === 'quote') blockField(card, block, 'caption', 'Attribution', 'input');
    }
    container.append(card);
  });
}
async function refresh() { state.posts = (await api('posts')).posts; renderList(); }
async function save() {
  const record = await api('save', { id: state.current?.id, version: state.current?.version, draft: collect() });
  state.current = record; draft = clone(record.draft); state.dirty = false;
  await refresh(); fillFields(); renderBlocks(); status(record.live ? 'Draft saved · live article unchanged until you publish' : 'Draft saved privately');
  return record;
}
async function action(name, extra = {}, saveFirst = true) {
  if (saveFirst && (state.dirty || !state.current)) await save();
  if (!state.current) throw new Error('Save your article first.');
  const record = await api('action', { id: state.current.id, version: state.current.version, action: name, ...extra });
  await refresh(); select(record);
  status(name === 'publish' ? 'Published · article, indexes and feed updated' : name === 'schedule' ? 'Scheduled for ' + new Date(record.scheduledAt).toLocaleString() : 'Saved · ' + postStatus(record));
}
function renderAssets() {
  $('#media-library').replaceChildren(...state.assets.map(asset => {
    const card = el('div', null, { class: 'media-item' }); card.append(el('img', null, { src: asset.preview, alt: '', loading: 'lazy' }), el('small', asset.name));
    card.append(button('Cover', () => { $('[data-field="cover"]').value = asset.url; $('[data-field="coverAlt"]').focus(); markDirty(); }), button('+ Image', () => {
      draft.blocks.push({ type: 'image', url: asset.url, alt: '', caption: '' }); renderBlocks(); markDirty(); $('#blocks').lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
    })); return card;
  }));
}
function showLogin() { $('#studio-app').hidden = true; $('#studio-login').hidden = false; }
async function start() {
  const session = await api('session'); state.local = session.localOwner;
  if (!session.authenticated) return showLogin();
  $('#studio-login').hidden = true; $('#studio-app').hidden = false; $('#logout').hidden = state.local;
  await refresh(); select(state.posts.find(post => !post.archived) || null); state.assets = (await api('assets')).assets; renderAssets();
}
for (const input of fields) input.addEventListener('input', markDirty);
for (const id of ['tags', 'sources', 'related', 'faqs', 'published-at']) $('#' + id).addEventListener('input', markDirty);
$('#post-search').addEventListener('input', renderList); $('#post-filter').addEventListener('change', renderList);
$('#new-post').addEventListener('click', () => { if (safeSwitch()) { select(); $('#post-title').focus(); } });
$('#add-block').addEventListener('click', () => { draft.blocks.push({ type: $('#block-type').value, text: '' }); renderBlocks(); markDirty(); });
$('#save').addEventListener('click', () => run(save));
$('#publish').addEventListener('click', () => run(() => action('publish')));
$('#schedule').addEventListener('click', () => run(() => {
  if (!$('#schedule-at').value) throw new Error('Choose a date and time for publication.');
  return action('schedule', { when: new Date($('#schedule-at').value).toISOString() });
}));
for (const name of ['cancel-schedule', 'unpublish', 'archive', 'restore']) {
  $('#' + (name === 'restore' ? 'restore-post' : name)).addEventListener('click', () => run(() => action(name)));
}
$('#restore-revision').addEventListener('click', () => { if (safeSwitch()) run(() => action('revision', { revision: Number($('#revisions').value) }, false)); });
$('#duplicate').addEventListener('click', () => run(async () => {
  const copied = collect(); copied.title += ' (copy)'; copied.slug += '-copy'; copied.publishedAt = ''; delete copied.updatedAt;
  let suffix = 2; const base = copied.slug;
  while (state.posts.some(p => p.draft.slug === copied.slug)) copied.slug = base + '-' + suffix++;
  const record = await api('save', { draft: copied }); await refresh(); select(record);
}));
$('#preview').addEventListener('click', () => run(async () => {
  const result = await api('preview', { draft: collect() });
  // The preview is inert: no editorial scripts or navigation can execute in this frame.
  const documentPreview = new DOMParser().parseFromString(result.html, 'text/html');
  documentPreview.querySelectorAll('script, .copy-link').forEach(node => node.remove());
  const base = documentPreview.createElement('base'); base.href = location.origin + '/'; documentPreview.head.prepend(base);
  documentPreview.querySelectorAll('a').forEach(link => { link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); });
  $('#preview-dialog iframe').srcdoc = '<!doctype html>' + documentPreview.documentElement.outerHTML; $('#preview-dialog').showModal();
}));
$('#close-preview').addEventListener('click', () => $('#preview-dialog').close());
$('#media-upload').addEventListener('change', () => run(async () => {
  const file = $('#media-upload').files[0]; if (!file) return;
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose an image smaller than 8 MB.');
  const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
  const uploaded = await api('upload', { name: file.name, data }); state.assets.unshift(uploaded); renderAssets(); $('#media-upload').value = ''; status('Image uploaded privately. Add alt text when you use it.');
}));
$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); $('#login-error').textContent = '';
  try { await api('login', { password: $('#password').value }); $('#password').value = ''; await start(); }
  catch (cause) { $('#login-error').textContent = cause.message; }
});
$('#logout').addEventListener('click', async () => { if (safeSwitch()) { await api('logout', {}); showLogin(); } });
$('#access-open').addEventListener('click', () => { $('#access-message').textContent = ''; $('#access-dialog').showModal(); });
$('#close-access').addEventListener('click', () => $('#access-dialog').close());
$('#access-form').addEventListener('submit', async event => {
  event.preventDefault();
  try { await api('password', { password: $('#new-password').value }); $('#new-password').value = ''; $('#access-message').textContent = 'Passphrase saved. Use it to sign in from your other device.'; if (!state.local) { $('#access-dialog').close(); showLogin(); } }
  catch (cause) { $('#access-message').textContent = cause.message; }
});
window.addEventListener('beforeunload', event => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });
document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 's') { event.preventDefault(); if (!$('#studio-app').hidden) run(save); } });
start().catch(cause => { showLogin(); $('#login-error').textContent = 'The editor needs the portfolio Python server. ' + cause.message; });
