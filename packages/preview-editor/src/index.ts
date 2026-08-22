// Shared preview-editor runtime for generated landing pages. The web app's
// sandboxed iframe and the native app's WebView inject the SAME editor
// script and speak the SAME postMessage protocol — this package is the one
// source of truth for both (script, protocol schemas, token parsing, and the
// pending-op batch builders).

export * from "./contrast";
export * from "./editor-script";
export * from "./inject";
export * from "./messages";
export * from "./parse-tokens";
export * from "./pending";
export * from "./target-comments";
