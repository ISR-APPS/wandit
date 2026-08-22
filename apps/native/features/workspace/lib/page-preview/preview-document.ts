// WebView document assembly for the generated landing page. The canonical
// HTML gets the SAME editor script the web injects into its iframe
// (@wandit/preview-editor), plus a thin native adapter that forwards the
// protocol's child messages to React Native. The protocol itself is
// unchanged: in a top frame `window.parent === window`, so the editor
// script's `event.source !== window.parent` guard accepts self-posted parent
// messages, and its `window.parent.postMessage(...)` child messages fire on
// the same window where the adapter listens.

import {
	injectPreviewEditor,
	type PreviewParentMessage,
} from "@wandit/preview-editor";

const NATIVE_ADAPTER_ID = "__wandit-native-adapter";

// Child→parent types (messages.ts childMessageSchema). Parent→child types
// are disjoint, so membership is enough to split the two directions on the
// shared window.
const NATIVE_ADAPTER_SCRIPT = `
(function () {
	"use strict";
	var CHILD_TYPES = {
		ready: 1,
		select: 1,
		deselect: 1,
		"selection-rect": 1,
		escape: 1,
		"ask-ai-shortcut": 1,
		"text-edited": 1
	};
	window.addEventListener("message", function (ev) {
		var m = ev && ev.data;
		if (!m || m.source !== "wandit-preview" || m.v !== 1) return;
		if (CHILD_TYPES[m.type] !== 1) return;
		if (window.ReactNativeWebView) {
			window.ReactNativeWebView.postMessage(JSON.stringify(m));
		}
	});
})();
`;

/** Canonical version HTML → the document the WebView renders. The editor
 *  block goes in first (before the last </body>), the adapter right after it,
 *  so the adapter's listener exists before the editor's async "ready" lands. */
export function buildPreviewDocument(html: string): string {
	const withEditor = injectPreviewEditor(html);
	const adapterBlock = `<script id="${NATIVE_ADAPTER_ID}">${NATIVE_ADAPTER_SCRIPT}</script>`;
	const index = withEditor.toLowerCase().lastIndexOf("</body>");
	if (index === -1) return withEditor + adapterBlock;
	return (
		withEditor.slice(0, index) + adapterBlock + withEditor.slice(index)
	);
}

/** Serialize a parent message for WebView.injectJavaScript. U+2028/U+2029 are
 *  valid JSON but illegal in JS source — strip them so injection can't break
 *  on user-typed content. */
export function parentMessageScript(message: PreviewParentMessage): string {
	const json = JSON.stringify(message).replace(/[\u2028\u2029]/g, "");
	return `window.postMessage(${json}, "*"); true;`;
}

/** Native-only chrome insets: pad the page body so the floating bars/sheets
 *  never cover the page's own start/end content. Idempotent direct DOM write
 *  (no protocol message needed — this never persists). */
export function chromeInsetsScript(top: number, bottom: number): string {
	const t = Math.max(0, Math.round(top));
	const b = Math.max(0, Math.round(bottom));
	return `(function(){var s=document.body&&document.body.style;if(s){s.paddingTop="${t}px";s.paddingBottom="${b}px";}})(); true;`;
}
