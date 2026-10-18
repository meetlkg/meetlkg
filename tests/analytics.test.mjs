import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../static/analytics.js', import.meta.url), 'utf8');
function site({ hostname = 'gok03.com', pathname = '/', noindex = false } = {}) {
  const injected = [], listeners = new Map();
  const window = { location: { hostname, pathname } };
  const document = {
    querySelector: () => noindex ? {} : null,
    createElement: () => ({}),
    getElementsByTagName: () => [{ parentNode: { insertBefore: script => injected.push(script) } }],
    addEventListener: (name, handler) => listeners.set(name, handler)
  };
  const run = () => runInNewContext(source, { window, document, URL });
  run();
  return { window, injected, listeners, run };
}

test('private/local pages never load the analytics SDK', () => {
  for (const options of [
    { hostname: 'localhost' }, { hostname: '127.0.0.1' }, { hostname: '100.127.12.50' },
    { hostname: 'preview.example.com' }, { pathname: '/admin/' }, { pathname: '/api/posts' },
    { pathname: '/.cms/drafts/' }, { noindex: true }
  ]) {
    const { window, injected, listeners } = site(options);
    assert.equal(window.posthog, undefined);
    assert.equal(injected.length, 0);
    assert.equal(listeners.size, 0);
  }
});

test('public pages initialize once and queue interactions while the SDK loads', () => {
  for (const hostname of ['gok03.com', 'www.gok03.com']) {
    const page = site({ hostname, pathname: '/blog/local-model-agent-harnesses-dgx-spark/' });
    page.run();
    assert.equal(page.injected.length, 1);
    assert.equal(page.injected[0].async, true);
    assert.equal(page.injected[0].src, 'https://us-assets.i.posthog.com/static/array.js');
    assert.equal(page.window.posthog._i.length, 1);
    page.listeners.get('portfolio:chat-open')({ detail: { question: 'private question' } });
    assert.equal(page.window.posthog[0][1], 'portfolio_chat_opened');
    assert.equal(JSON.stringify(page.window.posthog).includes('private question'), false);
  }
});

test('recordings mask chat and inputs, and never collect network payloads or console logs', () => {
  const config = site().window.posthog._i[0][1];
  assert.equal(config.disable_session_recording, false);
  assert.equal(config.session_recording.maskAllInputs, true);
  assert.equal(config.session_recording.maskTextSelector, '#avatar-transcript');
  assert.equal(config.session_recording.recordBody, false);
  assert.equal(config.session_recording.recordHeaders, false);
  assert.equal(config.enable_recording_console_log, false);
  assert.ok(config.autocapture.css_selector_ignorelist.includes('#avatar-transcript'));
  assert.ok(config.autocapture.css_selector_ignorelist.includes('#avatar-question'));
  assert.equal(config.respect_dnt, true);
});

test('unanswered contact events contain the outcome, never the question', () => {
  const page = site();
  page.listeners.get('portfolio:contact')({ detail: { unresolved: true, question: 'private text' } });
  assert.equal(page.window.posthog[0][1], 'portfolio_contact_opened');
  assert.equal(page.window.posthog[0][2].source, 'unanswered_question');
  assert.equal(JSON.stringify(page.window.posthog).includes('private text'), false);
});
