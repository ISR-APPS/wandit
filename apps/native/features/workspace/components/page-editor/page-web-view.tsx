import {
	parsePreviewMessage,
	type PreviewParentMessage,
	type PreviewSelection,
} from "@wandit/preview-editor";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import {
	buildPreviewDocument,
	chromeInsetsScript,
	parentMessageScript,
} from "../../lib/page-preview/preview-document";

export type PreviewPoster = (message: PreviewParentMessage) => void;

type PagePreviewWebViewProps = {
	/** CANONICAL version HTML — the editor script + native adapter are
	 * injected here at render time, never into anything sent back. */
	html: string;
	/** Receives the poster once per mount. Messages posted before the editor
	 * script's "ready" are queued and flushed on ready, so callers can push
	 * state unconditionally. */
	registerPost: (post: PreviewPoster | null) => void;
	/** Editor script booted in a fresh document — re-send mode/pins and
	 * replay pending edits here (the WebView remounts per version/discard). */
	onReady: () => void;
	onSelect: (selection: PreviewSelection) => void;
	onDeselect: () => void;
	/** 0 at the page top, ramping to 1 over the first ~64px of scroll —
	 * drives how strongly the top chrome blurs in. */
	onScrollProgress: (progress: number) => void;
	backgroundColor: string;
	/** Body padding keeping the page clear of the floating chrome. */
	insetTop: number;
	insetBottom: number;
};

/** The generated-page surface: a WebView speaking the SAME preview protocol
 * as the web's sandboxed iframe (@wandit/preview-editor). */
export function PagePreviewWebView({
	html,
	registerPost,
	onReady,
	onSelect,
	onDeselect,
	onScrollProgress,
	backgroundColor,
	insetTop,
	insetBottom,
}: PagePreviewWebViewProps) {
	const webViewRef = useRef<WebView>(null);
	const readyRef = useRef(false);
	const queueRef = useRef<PreviewParentMessage[]>([]);
	const insetsRef = useRef({ top: insetTop, bottom: insetBottom });
	insetsRef.current = { top: insetTop, bottom: insetBottom };

	// Latest-handlers ref: the WebView mounts once per document while callers
	// pass fresh closures every render.
	const handlersRef = useRef({ onReady, onSelect, onDeselect });
	handlersRef.current = { onReady, onSelect, onDeselect };

	const post = useCallback((message: PreviewParentMessage) => {
		if (!readyRef.current) {
			queueRef.current.push(message);
			return;
		}
		webViewRef.current?.injectJavaScript(parentMessageScript(message));
	}, []);

	useEffect(() => {
		registerPost(post);
		return () => registerPost(null);
	}, [post, registerPost]);

	// Keep the page body clear of the floating bars/sheets as they resize.
	useEffect(() => {
		if (!readyRef.current) return;
		webViewRef.current?.injectJavaScript(
			chromeInsetsScript(insetTop, insetBottom),
		);
	}, [insetTop, insetBottom]);

	function handleMessage(event: WebViewMessageEvent) {
		let raw: unknown;
		try {
			raw = JSON.parse(event.nativeEvent.data);
		} catch {
			return;
		}
		const message = parsePreviewMessage(raw);
		if (!message) return;
		switch (message.type) {
			case "ready": {
				readyRef.current = true;
				webViewRef.current?.injectJavaScript(
					chromeInsetsScript(insetsRef.current.top, insetsRef.current.bottom),
				);
				const queued = queueRef.current;
				queueRef.current = [];
				for (const pending of queued) {
					webViewRef.current?.injectJavaScript(parentMessageScript(pending));
				}
				handlersRef.current.onReady();
				break;
			}
			case "select":
				handlersRef.current.onSelect(message.payload);
				break;
			case "deselect":
				handlersRef.current.onDeselect();
				break;
			default:
				// selection-rect / escape / ask-ai-shortcut / text-edited are
				// web-inspector concerns — native edits text in its own sheet.
				break;
		}
	}

	const document = useMemo(() => buildPreviewDocument(html), [html]);

	return (
		<WebView
			ref={webViewRef}
			source={{ html: document }}
			originWhitelist={["about:blank"]}
			onMessage={handleMessage}
			// The preview never navigates: link taps inside the page are inert
			// (the published site is where links live).
			onShouldStartLoadWithRequest={(request) =>
				request.url === "about:blank" || request.url.startsWith("data:")
			}
			onScroll={(event) => {
				const y = event.nativeEvent.contentOffset.y;
				onScrollProgress(Math.max(0, Math.min(1, y / 64)));
			}}
			setSupportMultipleWindows={false}
			javaScriptEnabled
			domStorageEnabled={false}
			allowsLinkPreview={false}
			bounces
			style={{ flex: 1, backgroundColor }}
		/>
	);
}
