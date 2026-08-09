// Smooth per-character reveal for streamed text, after Sam Selikoff's
// useAnimatedText hook (github.com/samselikoff/2024-10-20-use-animated-text-hook).
//
// The problem it solves: the network delivers text in uneven bursts, so
// rendering `text` directly looks like blocks snapping in. This hook keeps a
// motion value — an animated number — gliding toward the CURRENT length of
// the text, and returns only the first `cursor` characters. The glide is
// continuous no matter how chunky the arrivals are, so the reveal reads like
// steady typing with a soft ease-out tail.

import { animate, useMotionValue } from "motion/react";
import { useEffect, useState } from "react";

export function useAnimatedText(text: string, enabled: boolean): string {
	const animatedCursor = useMotionValue(enabled ? 0 : Number.MAX_SAFE_INTEGER);
	const [cursor, setCursor] = useState(enabled ? 0 : Number.MAX_SAFE_INTEGER);
	const [prevText, setPrevText] = useState(text);
	const [isSameText, setIsSameText] = useState(true);

	// Adjust-state-during-render (the React-sanctioned alternative to a
	// setState-in-effect): when the text prop changes, detect whether it still
	// APPENDS to what we had. A brand-new text (e.g. the next assistant reply
	// reusing this component) must restart the reveal from zero.
	if (prevText !== text) {
		setPrevText(text);
		setIsSameText(text.startsWith(prevText));

		if (!text.startsWith(prevText)) {
			setCursor(0);
		}
	}

	// `[...text]` splits by code point, not UTF-16 halves — a plain
	// `text.split("")` would briefly render broken half-emoji (�) since
	// emoji occupy two JS string slots.
	const characters = [...text];

	useEffect(() => {
		if (!enabled) return;

		if (!isSameText) {
			// jump() teleports the motion value with no tween — restart point.
			animatedCursor.jump(0);
		}

		// Animate the cursor toward the full current length. Every new chunk
		// re-runs this effect with a farther target; easeOut means it moves
		// fast while behind and lands gently — the "Lovable" feel.
		const controls = animate(animatedCursor, characters.length, {
			duration: 1.2,
			ease: "easeOut",
			onUpdate(latest) {
				setCursor(Math.floor(latest));
			},
		});

		return () => controls.stop();
	}, [animatedCursor, enabled, isSameText, characters.length]);

	// Disabled (historical messages): show everything immediately.
	if (!enabled) return text;

	return characters.slice(0, cursor).join("");
}
