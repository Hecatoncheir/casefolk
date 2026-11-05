const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const active = new Map();

export function motion(element, keyframes, duration = 240) {
  if (!element?.animate || reducedMotion.matches) return Promise.resolve();
  active.get(element)?.cancel();
  const animation = element.animate(keyframes, {
    duration,
    easing: 'cubic-bezier(.22, 1, .36, 1)',
  });
  active.set(element, animation);
  return animation.finished.catch(() => {}).finally(() => {
    if (active.get(element) === animation) active.delete(element);
  });
}

export function reveal(element, duration = 280, distance = 6) {
  return motion(element, [
    { opacity: 0.75, transform: `translateY(${distance}px)` },
    { opacity: 1, transform: 'translateY(0)' },
  ], duration);
}

reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) active.forEach(animation => animation.cancel());
});
