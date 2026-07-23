import '@testing-library/jest-dom'
// Initialize i18next once for the whole test suite so components that call
// useTranslation() render real English strings instead of raw keys.
import '@/i18n'

// jsdom (as wired by this vitest version) doesn't populate window.localStorage /
// window.sessionStorage, so provide a minimal in-memory Storage polyfill for tests.
class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length() {
    return this.store.size
  }

  clear() {
    this.store.clear()
  }

  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string) {
    this.store.delete(key)
  }

  setItem(key: string, value: string) {
    this.store.set(key, value)
  }
}

for (const key of ['localStorage', 'sessionStorage'] as const) {
  if (!window[key]) {
    Object.defineProperty(window, key, { value: new MemoryStorage(), configurable: true })
  }
}

// jsdom doesn't implement ResizeObserver; several Radix UI primitives (e.g.
// Checkbox, Select) use it internally.
if (!window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// jsdom doesn't implement scrollIntoView or pointer capture, both of which
// Radix's Select popper uses on open — without these, opening a Select in a
// test throws (`candidate?.scrollIntoView is not a function`).
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {}
}
