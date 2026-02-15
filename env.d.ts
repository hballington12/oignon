/// <reference types="vite/client" />

// VS Code WebView API (injected by the extension host)
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void
  getState(): unknown
  setState(state: unknown): void
}
