// Smooth per-character reveal for streamed text (native twin of the web
// hook, after Sam Selikoff's useAnimatedText). The network delivers text in
// uneven bursts; rendering it directly looks like blocks snapping in. This
// hook glides a cursor toward the CURRENT length of the text and returns only
// the first `cursor` code points, so the reveal reads like steady typing with
// a soft ease-out tail. A plain rAF drive, not Reanimated: the cursor must
// update React state every frame regardless, so a worklet buys nothing.

import { useEffect, useRef, useState } from "react";

const REVEAL_DURATION_MS = 1200;

function easeOutCubic(t: number): number {
	return 1 - (1 - t) ** 3;
}

export function useAnimatedText(text: string, enabled: boolean): string {
	const [cursor, setCursor] = useState(enabled ? 0 : Number.MAX_SAFE_INTEGER);
	const [prevText, setPrevText] = useState(text);
	const [isSameText, setIsSameText] = useState(true);
	// The gliding cursor position survives re-renders between frames.
	const floatCursorRef = useRef(enabled ? 0 : Number.MAX_SAFE_INTEGER);

	// Adjust-state-during-render: when the text prop changes, detect whether
	// it still APPENDS to what we had. A brand-new text (the next assistant
	// reply reusing this component) must restart the reveal from zero.
	if (prevText !== text) {
		setPrevText(text);
		setIsSameText(text.startsWith(prevText));

		if (!text.startsWith(prevText)) {
			setCursor(0);
		}
	}

	// `[...text]` splits by code point, not UTF-16 halves — a plain
	// `text.split("")` would briefly render broken half-emoji (�).
	const characters = [...text];
	const targetLength = characters.length;

	useEffect(() => {
		if (!enabled) return;

		if (!isSameText) {
			floatCursorRef.current = 0;
		}

		// Animate toward the full current length. Every new chunk re-runs this
		// effect with a farther target; easeOut means the cursor moves fast
		// while behind and lands gently.
		const startValue = Math.min(floatCursorRef.current, targetLength);
		const startTime = performance.now();
		let frame = 0;

		const tick = (now: number) => {
			const progress = Math.min(1, (now - startTime) / REVEAL_DURATION_MS);
			const value =
				startValue + (targetLength - startValue) * easeOutCubic(progress);
			floatCursorRef.current = value;
			setCursor(Math.floor(value));
			if (progress < 1) {
				frame = requestAnimationFrame(tick);
			}
		};
		frame = requestAnimationFrame(tick);

		return () => cancelAnimationFrame(frame);
	}, [enabled, isSameText, targetLength]);

	// Disabled (historical messages): show everything immediately.
	if (!enabled) return text;

	return characters.slice(0, Math.min(cursor, targetLength)).join("");
}
