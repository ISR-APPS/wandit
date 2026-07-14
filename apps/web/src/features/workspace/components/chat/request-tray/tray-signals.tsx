// Small shared visuals for the request-tray system: the spinning ember arc,
// plus the two companion signals that point at a waiting tray from elsewhere
// in the pane — the pane-header status pill ("● Needs a detail") and the
// in-thread pointer chip ("? 1 question · on the composer ↓"). The chip lives
// at the end of the Wandit message that asked; the pill lives in the chat
// header. Copy comes in via props — the caller owns it.

import { cn } from "@wandit/ui/lib/utils";
import { ImageIcon, SlidersHorizontal } from "lucide-react";

/** Spinning ember arc on a stone track — the tray/composer working marker. */
export function SpinnerArc({ className }: { className?: string }) {
	return (
		<svg
			className={cn("size-[15px] shrink-0 animate-spin", className)}
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

/** Pane-header pill: pulsing ember dot + what the tray is waiting for.
    `solid` stops the pulse — the design's cue that the build is BLOCKED on
    this answer (10o), not just enrichable. */
export function TrayStatusPill({
	label,
	solid = false,
	className,
}: {
	label: string;
	solid?: boolean;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 text-[12.5px] text-ember-text",
				className,
			)}
		>
			<span
				aria-hidden
				className={cn(
					"size-[7px] rounded-full bg-primary",
					!solid && "animate-pulse-soft",
				)}
			/>
			{label}
		</span>
	);
}

export type TrayPointerIcon = "question" | "options" | "media";

/** In-thread receipt chip pointing at the docked tray — mono micro-copy like
    "1 question · on the composer ↓". Rendered under the Wandit message that
    raised the ask. */
export function TrayPointerChip({
	icon = "question",
	label,
	className,
}: {
	icon?: TrayPointerIcon;
	label: string;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-[7px] rounded-full border border-border bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground",
				className,
			)}
		>
			{icon === "question" ? (
				<span
					aria-hidden
					className="grid size-3.5 shrink-0 place-items-center rounded-[5px] border border-primary/40 bg-primary/12 font-sans font-semibold text-[9px] text-ember-text"
				>
					?
				</span>
			) : icon === "media" ? (
				<ImageIcon className="size-3 shrink-0 text-ember-text" />
			) : (
				<SlidersHorizontal className="size-3 shrink-0 text-ember-text" />
			)}
			{label}
		</span>
	);
}
