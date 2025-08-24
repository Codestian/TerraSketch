export function portal(node: HTMLElement, target: HTMLElement = document.body) {
  if (typeof document !== 'undefined' && node.parentNode !== target) {
    target.appendChild(node);
  }
  return {
    destroy() {
      if (typeof document !== 'undefined' && node.parentNode === target) {
        target.removeChild(node);
      }
    }
  };
}


