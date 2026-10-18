// Keep model imports and downloads out of the page's first paint.
export function lazyVisible(target, load) {
 let visible = false, painted = false, stopped = false, idle = null, frame;
 const useIdle = typeof window.requestIdleCallback === 'function';
 const eligible = () => !stopped && painted && visible && !document.hidden;
 function cancelIdle() {
  if (idle === null) return;
  if (useIdle) window.cancelIdleCallback(idle);
  else window.clearTimeout(idle);
  idle = null;
 }
 function start() {
  idle = null;
  if (!eligible()) return;
  dispose();
  load();
 }
 function schedule() {
  cancelIdle();
  if (!eligible()) return;
  idle = useIdle ? window.requestIdleCallback(start, { timeout: 1800 }) : window.setTimeout(start, 150);
 }
 const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
  visible = entries.some(entry => entry.isIntersecting);
  schedule();
 }) : null;
 if (observer) observer.observe(target);
 else visible = true;
 document.addEventListener('visibilitychange', schedule);
 // Two frames give the static page a paint before even an immediate idle slot.
 frame = requestAnimationFrame(() => {
  frame = requestAnimationFrame(() => { painted = true; schedule(); });
 });
 function dispose() {
  stopped = true;
  cancelAnimationFrame(frame);
  cancelIdle();
  observer?.disconnect();
  document.removeEventListener('visibilitychange', schedule);
 }
 return dispose;
}
