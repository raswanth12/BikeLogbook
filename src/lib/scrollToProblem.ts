/**
 * After a blocked save, brings the first error or odometer warning into view. Runs on the next
 * frame, once the messages have rendered. If the save went through, there's nothing to find.
 */
export function scrollToFirstProblem() {
  requestAnimationFrame(() => {
    const el = document.querySelector('.error, .warning');
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  });
}
