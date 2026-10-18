import test from 'node:test';
import assert from 'node:assert/strict';
import {lazyVisible} from '../static/lazy-visible.js';

function setup(t, {fallback = false} = {}) {
 const frames = new Map(), idle = new Map();
 const doc = new EventTarget(); doc.hidden = false;
 let next = 0, observer, calls = 0;
 const queue = map => fn => { const id = ++next; map.set(id, fn); return id; };
 class Observer {
  constructor(callback) { this.callback = callback; observer = this; }
  observe() {}
  disconnect() { this.disconnected = true; }
 }
 const bindings = {
  document: doc,
  window: {
   requestIdleCallback: fallback ? undefined : queue(idle),
   cancelIdleCallback: id => idle.delete(id),
   setTimeout: queue(idle), clearTimeout: id => idle.delete(id)
  },
  IntersectionObserver: fallback ? undefined : Observer,
  requestAnimationFrame: queue(frames), cancelAnimationFrame: id => frames.delete(id)
 };
 const restore = [];
 for (const [key, value] of Object.entries(bindings)) {
  const old = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, {value, configurable: true});
  restore.push(() => old ? Object.defineProperty(globalThis, key, old) : delete globalThis[key]);
 }
 const flush = map => { const current = [...map.values()]; map.clear(); current.forEach(fn => fn()); };
 const cancel = lazyVisible({}, () => calls++);
 t.after(() => { cancel(); restore.forEach(reset => reset()); });
 return {idle, cancel, get calls() { return calls; },
  frame: () => flush(frames), run: () => flush(idle),
  visible: value => observer.callback([{isIntersecting: value}]),
  hidden: value => { doc.hidden = value; doc.dispatchEvent(new Event('visibilitychange')); }
 };
}

test('a visible portrait waits for a paint and idle time, then loads once', t => {
 const page = setup(t);
 page.visible(true); assert.equal(page.idle.size, 0);
 page.frame(); assert.equal(page.idle.size, 0);
 page.frame(); assert.equal(page.calls, 0); assert.equal(page.idle.size, 1);
 page.run(); assert.equal(page.calls, 1);
 page.visible(true); page.hidden(false); page.run(); assert.equal(page.calls, 1);
});

test('offscreen and background pages defer downloads until visible again', t => {
 const page = setup(t);
 page.frame(); page.frame(); assert.equal(page.idle.size, 0);
 page.visible(true); page.hidden(true); assert.equal(page.idle.size, 0);
 page.hidden(false); page.visible(false); assert.equal(page.idle.size, 0);
 page.visible(true); page.run(); assert.equal(page.calls, 1);
});

test('leaving the page cancels a queued model load, even a late idle callback', t => {
 const page = setup(t);
 page.visible(true); page.frame(); page.frame();
 const late = [...page.idle.values()][0];
 page.cancel(); late(); page.hidden(false); page.run(); assert.equal(page.calls, 0);
});

test('browsers without idle or intersection APIs still paint before loading', t => {
 const page = setup(t, {fallback: true});
 assert.equal(page.idle.size, 0);
 page.frame(); page.frame(); assert.equal(page.calls, 0);
 page.run(); assert.equal(page.calls, 1);
});
