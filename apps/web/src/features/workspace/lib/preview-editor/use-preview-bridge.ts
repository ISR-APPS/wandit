// The app side of the preview postMessage bridge (contract §11). Accepts a
// message ONLY when it comes from OUR iframe's contentWindow AND parses
// against the protocol schemas — `event.origin` is "null" (opaque sandbox
// origin) and is deliberately ignored. Returns `post` for parent→child
// messages (targetOrigin "*" is unavoidable with an opaque origin; payloads
// carry no secrets).

import { type RefObject, useCallback, useEffect, useRef } from "react";

import {
	type PreviewParentMessage,
	type PreviewSelection,
	parsePreviewMessage,
} from "./messages";

export type PreviewBridgeHandlers = {
	onSelect?: (selection: PreviewSelection) => void;
	onDeselect?: () => void;
	onTextEdited?: (wid: string, value: string) => void;
	/** Editor script booted — re-send the current mode here (the iframe
	 *  remounts per version / reload / discard). */
	onReady?: () => void;
};

export function usePreviewBridge({
	iframeRef,
	...handlers
}: PreviewBridgeHandlers & {
	iframeRef: RefObject<HTMLIFrameElement | null>;
}) {
	// Latest-handlers ref: the listener stays attached once while callers may
	// pass fresh closures every render.
	const handlersRef = useRef<PreviewBridgeHandlers>(handlers);
	handlersRef.current = handlers;

	useEffect(() => {
		const listener = (event: MessageEvent) => {
			const frame = iframeRef.current;
			if (!frame || event.source !== frame.contentWindow) return;
			const message = parsePreviewMessage(event.data);
			if (!message) return;
			switch (message.type) {
				case "ready":
					handlersRef.current.onReady?.();
					break;
				case "select":
					handlersRef.current.onSelect?.(message.payload);
					break;
				case "deselect":
					handlersRef.current.onDeselect?.();
					break;
				case "text-edited":
					handlersRef.current.onTextEdited?.(
						message.payload.wid,
						message.payload.value,
					);
					break;
			}
		};
		window.addEventListener("message", listener);
		return () => window.removeEventListener("message", listener);
	}, [iframeRef]);

	return useCallback(
		(message: PreviewParentMessage) => {
			iframeRef.current?.contentWindow?.postMessage(message, "*");
		},
		[iframeRef],
	);
}
