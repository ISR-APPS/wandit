// The request tray — the shared shell of every "waiting on you" chat state
// (design/Wandit-Workspace-v3.html, turn 10). It FUSES into the top of the
// PromptBox card: same rounded parchment shell, tray section one step darker
// (sand) above a hairline divider, composer beneath. Anatomy: context header
// (badge + mono label naming what's needed), exactly ONE escape hatch, a
// dismiss X, the question + helper, and the swappable answer body
// (tray-bodies.tsx). Settled answers remain in the chat transcript; the tray
// intentionally renders only the question that still needs an answer.

import { cn } from "@wandit/ui/lib/utils";
import {
	AlertTriangle,
	CalendarDays,
	Download,
	FileText,
	ImageIcon,
	Link2,
	type LucideIcon,
	RefreshCw,
	X,
} from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { type TrayBodyCallbacks, TrayBodySlot } from "./tray-bodies";
import { SpinnerArc } from "./tray-signals";
import type { RequestTrayState, TrayBadgeIcon } from "./types";

const BADGE_ICONS: Partial<Record<TrayBadgeIcon, LucideIcon>> = {
	media: ImageIcon,
	file: FileText,
	link: Link2,
	calendar: CalendarDays,
	access: Download,
	confirm: AlertTriangle,
};

const LABEL_TONES = {
	ember: "text-ember-text",
	amber: "text-[oklch(0.55_0.13_70)]",
	muted: "text-muted-foreground",
} as const;

const BADGE_TONES = {
	ember: "border-primary/40 bg-primary/12 text-ember-text",
	amber:
		"border-[oklch(0.6_0.14_75_/_0.5)] bg-[oklch(0.6_0.14_75_/_0.15)] text-[oklch(0.55_0.13_70)]",
	muted: "border-stone bg-transparent text-muted-foreground",
} as const;

export function RequestTray({
	state,
	onEscape,
	onDismiss,
	bodyCallbacks,
}: {
	state: RequestTrayState;
	onEscape?: () => void;
	onDismiss?: () => void;
	/** Live answer wiring for the interactive bodies (use-request-tray.ts). */
	bodyCallbacks?: TrayBodyCallbacks;
}) {
	const { t } = useTranslation();
	const tone = state.labelTone ?? "ember";
	const hasBody = state.body.kind !== "free-text";

	return (
		<div className="border-border border-b bg-secondary px-[15px] pt-[13px] pb-3.5">
			<div className="flex items-center gap-2">
				<TrayBadge icon={state.badge} tone={tone} />
				<span
					className={cn(
						"min-w-0 truncate font-mono text-[10.5px] uppercase tracking-[0.1em]",
						LABEL_TONES[tone],
					)}
				>
					{state.label}
				</span>
				<div className="ms-auto flex shrink-0 items-center gap-1.5">
					{state.meta ? (
						<span className="font-mono text-[10.5px] text-muted-foreground">
							{state.meta}
						</span>
					) : null}
					{state.escape ? (
						<button
							type="button"
							onClick={onEscape}
							className="flex h-[26px] items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 text-muted-foreground text-xs tracking-[-0.025em] transition-colors hover:bg-accent hover:text-foreground"
						>
							{state.escape.icon === "shuffle" ? (
								<RefreshCw className="size-3" />
							) : null}
							{state.escape.label}
						</button>
					) : null}
					<button
						type="button"
						onClick={onDismiss}
						// Dismiss collapses the tray to a receipt chip in the thread —
						// it never discards the question.
						aria-label={t("workspace.chat.tray.dismiss")}
						className="grid size-[26px] place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>
						<X className="size-[13px]" strokeWidth={2} />
					</button>
				</div>
			</div>

			{state.question ? (
				<p
					dir="auto"
					className="mt-2.5 font-medium text-[15.5px] text-foreground leading-snug tracking-[-0.025em]"
				>
					{state.question}
				</p>
			) : null}
			{state.helper ? (
				<p dir="auto" className="mt-1 text-[12.5px] text-muted-foreground">
					{state.helper}
				</p>
			) : null}

			{hasBody ? (
				<div
					className={cn(
						"mt-[11px] transition-opacity",
						// Typing a free-form answer overrides the options — they dim but
						// stay visible so the user can still tap one (10n state 2).
						state.typingOverride && "opacity-[0.38]",
					)}
				>
					<TrayBodySlot body={state.body} callbacks={bodyCallbacks} />
				</div>
			) : null}
			{state.typingOverride ? (
				<p className="mt-2 text-[11.5px] text-ember-text">
					{t("workspace.chat.tray.typingOverride")}
				</p>
			) : null}
		</div>
	);
}

/** 20px context badge — "ember = waiting on you"; a spinner replaces the box
    while options are still being generated (7a). */
function TrayBadge({
	icon,
	tone,
}: {
	icon: TrayBadgeIcon;
	tone: keyof typeof BADGE_TONES;
}) {
	if (icon === "spinner") return <SpinnerArc />;
	const Icon = BADGE_ICONS[icon];
	return (
		<span
			aria-hidden
			className={cn(
				"grid size-5 shrink-0 place-items-center rounded-md border",
				BADGE_TONES[tone],
			)}
		>
			{Icon ? (
				<Icon className="size-3" strokeWidth={2.2} />
			) : (
				<span className="font-semibold text-[11px] leading-none">?</span>
			)}
		</span>
	);
}
