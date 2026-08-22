// Moved to the shared @wandit/preview-editor package so the native WebView
// preview speaks the exact same protocol. This shim keeps every existing
// relative import (and spec) pointing at the one source of truth.

export * from "@wandit/preview-editor/messages";
