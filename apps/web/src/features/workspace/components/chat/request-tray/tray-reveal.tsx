// Open/close motion for the request tray — the tray GROWS out of the
// composer card instead of snapping in (the design's 7a note: "the tray
// slides out of the prompt box"). CSS can't animate to height:auto, so this
// measures its content with a ResizeObserver and animates the container to
// the measured pixel height with motion — which also makes LATER height
// changes glide (body swaps and chips wrapping).
// Reusable: the live plumbing wraps RequestTray with this too; put it under
// an AnimatePresence to get the collapse-on-answer exit for free.

import { cn } from "@wandit/ui/lib/utils";
import { motion } from "motion/react";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

/** Calm, no-bounce ease for tray chrome — quiet motion per the design
    language ("calm chrome; energy stays on the generated thing"). */
export const TRAY_EASE = [0.32, 0.72, 0, 1] as const;

export function TrayReveal({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	const innerRef = useRef<HTMLDivElement>(null);
	const [height, setHeight] = useState(0);

	// Layout effect so the first real height lands before paint — the reveal
	// then animates 0 → measured on mount, and re-measures on every content
	// resize afterwards.
	useLayoutEffect(() => {
		const el = innerRef.current;
		if (!el) return;
		const measure = () => setHeight(el.offsetHeight);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	return (
		<motion.div
			initial={{ height: 0, opacity: 0 }}
			animate={{ height, opacity: 1 }}
			exit={{ height: 0, opacity: 0 }}
			transition={{ duration: 0.34, ease: TRAY_EASE }}
			className={cn("overflow-hidden", className)}
		>
			<div ref={innerRef}>{children}</div>
		</motion.div>
	);
}
