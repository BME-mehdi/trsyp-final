// Present in every runtime this package runs on (browsers, React Native, Node); the ES lib does not declare them.
declare function setTimeout(callback: () => void, ms: number): unknown
declare function clearTimeout(id: unknown): void
declare function queueMicrotask(callback: () => void): void
