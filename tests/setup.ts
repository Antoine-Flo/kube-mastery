// Setup for vitest tests
// Mock matchMedia for jsdom (needed by xterm.js)
// jsdom doesn't provide matchMedia API, but xterm.js requires it for media query detection
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => { }, // deprecated
        removeListener: () => { }, // deprecated
        addEventListener: () => { },
        removeEventListener: () => { },
        dispatchEvent: () => true,
    }),
})

// Mock ResizeObserver (needed by xterm.js)
// jsdom doesn't provide ResizeObserver API, but xterm.js uses it to detect terminal container size changes
// The void statements satisfy the linter while keeping the mock methods intentionally empty
globalThis.ResizeObserver = class ResizeObserver {
    observe() { void 0; }
    unobserve() { void 0; }
    disconnect() { void 0; }
}

