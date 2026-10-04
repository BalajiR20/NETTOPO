import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

// jsdom lacks these browser APIs used by React Flow / Radix.
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver ??= RO
if (typeof window !== 'undefined') {
  window.matchMedia ??= ((q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  // DOMMatrix used by React Flow
  ;(window as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly ??= class {
    m22 = 1
    constructor() {}
  }
  Element.prototype.scrollIntoView ??= () => {}
  HTMLCanvasElement.prototype.getContext ??= (() => null) as never
}
