/**
 * Open and close motion of the request tray, copied from the V1 tray: the
 * tray grows out of the composer card. CSS cannot animate to height auto,
 * so a ResizeObserver measures the content and `motion` animates to that
 * height. Rendered by chat-pane.tsx inside an AnimatePresence.
 */

import { cn } from "@wandit/ui/lib/utils";
import { motion, useIsPresent } from "motion/react";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

/** Calm ease with no bounce, the V1 tray curve. */
const TRAY_EASE = [0.32, 0.72, 0, 1] as const;

/** Grows the tray from 0 to the measured content height, and shrinks it to 0 on exit. */
export function TrayReveal({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	const innerRef = useRef<HTMLDivElement>(null);
	const [height, setHeight] = useState(0);

	// An exiting tray still renders the old question. Inert stops its buttons
	// from taking clicks, focus, and key presses that belong to the next round.
	const isPresent = useIsPresent();

	// A layout effect sets the first height before paint, so the tray grows
	// from 0 on mount and follows every later content resize.
	useLayoutEffect(() => {
		const element = innerRef.current;
		if (!element) return;
		const measure = () => setHeight(element.offsetHeight);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	return (
		<motion.div
			initial={{ height: 0, opacity: 0 }}
			animate={{ height, opacity: 1 }}
			exit={{ height: 0, opacity: 0 }}
			transition={{ duration: 0.34, ease: TRAY_EASE }}
			inert={!isPresent}
			className={cn("overflow-hidden", className)}
		>
			<div ref={innerRef}>{children}</div>
		</motion.div>
	);
}
