/**
 * Small visuals of the request tray, copied from the V1 tray: the spinning
 * ember arc of an upload in progress, and the chip in the thread that
 * points at the tray on the composer. Rendered by tray-bodies.tsx and
 * question-receipt.tsx. The caller passes the copy.
 */

import { cn } from "@wandit/ui/lib/utils";

/** Spinning ember arc on a stone track: the tray working marker. */
export function SpinnerArc({ className }: { className?: string }) {
	return (
		<svg
			className={cn(
				"size-[15px] shrink-0 animate-spin motion-reduce:animate-none",
				className,
			)}
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden
			role="presentation"
		>
			<circle cx="12" cy="12" r="9" stroke="var(--stone)" strokeWidth="2.5" />
			<path
				d="M12 3a9 9 0 0 1 9 9"
				stroke="var(--primary)"
				strokeWidth="2.5"
				strokeLinecap="round"
			/>
		</svg>
	);
}

/** Mono chip under an open question in the thread: it points at the tray below. */
export function TrayPointerChip({
	label,
	className,
}: {
	label: string;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center gap-[7px] rounded-full border border-border bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground",
				className,
			)}
		>
			<span
				aria-hidden
				className="grid size-3.5 shrink-0 place-items-center rounded-[5px] border border-primary/40 bg-primary/12 font-sans font-semibold text-[9px] text-ember-text"
			>
				?
			</span>
			{label}
		</span>
	);
}
