/**
 * The request tray: the card that opens on top of the composer when the
 * agent asks the user a question. A copy of the V1 tray shell with its
 * look: a badge and a mono label, the step count, the "Decide for me"
 * button, the skip X, the question and its helper, then the answer body
 * (tray-bodies.tsx). The composer below holds the answer button. Rendered
 * by chat-pane.tsx; lib/use-request-tray.ts builds the state.
 */

import { cn } from "@wandit/ui/lib/utils";
import { ImageIcon, X } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { type TrayBodyCallbacks, TrayBodySlot } from "./tray-bodies";
import type { RequestTrayState } from "./types";

/** Props from chat-pane.tsx; lib/use-request-tray.ts builds the state and the callbacks. */
export type RequestTrayProps = {
	/** The shell content of the shown question. */
	state: RequestTrayState;
	/** Answers the question with "Decide for me": the agent picks. */
	onDelegate: () => void;
	/** Hides the tray; the next plain message answers the question as skipped. */
	onDismiss: () => void;
	/** Pick, toggle, add-file, and remove-file handlers of the answer body. */
	bodyCallbacks: TrayBodyCallbacks;
};

/** The tray shell above the composer; the answer button stays in the composer. */
export function RequestTray({
	state,
	onDelegate,
	onDismiss,
	bodyCallbacks,
}: RequestTrayProps) {
	const { t } = useTranslation();

	return (
		<div className="border-border border-b bg-secondary px-[15px] pt-[13px] pb-3.5">
			<div className="flex items-center gap-2">
				<span
					aria-hidden
					className="grid size-5 shrink-0 place-items-center rounded-md border border-primary/40 bg-primary/12 text-ember-text"
				>
					{state.badge === "media" ? (
						<ImageIcon className="size-3" strokeWidth={2.2} />
					) : (
						<span className="font-semibold text-[11px] leading-none">?</span>
					)}
				</span>
				<span className="min-w-0 truncate font-mono text-[10.5px] text-ember-text uppercase tracking-[0.1em]">
					{state.label}
				</span>
				<div className="ms-auto flex shrink-0 items-center gap-1.5">
					{state.step !== null ? (
						<span className="font-mono text-[10.5px] text-muted-foreground">
							{t("appBuilder.chat.tray.step", {
								current: state.step.current,
								total: state.step.total,
							})}
						</span>
					) : null}
					<button
						type="button"
						onClick={onDelegate}
						className="flex h-[26px] items-center rounded-full border border-border bg-transparent px-2.5 text-muted-foreground text-xs tracking-[-0.025em] transition-colors hover:bg-accent hover:text-foreground"
					>
						{t("appBuilder.chat.tray.decideForMe")}
					</button>
					<button
						type="button"
						onClick={onDismiss}
						aria-label={t("appBuilder.chat.tray.dismiss")}
						className="grid size-[26px] place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>
						<X className="size-[13px]" strokeWidth={2} />
					</button>
				</div>
			</div>
			{/* Polite: each new step of a round reads out without a focus move. */}
			<p
				dir="auto"
				aria-live="polite"
				className="mt-2.5 font-medium text-[15.5px] text-foreground leading-snug tracking-[-0.025em]"
			>
				{state.question}
			</p>
			{state.helper !== null ? (
				<p dir="auto" className="mt-1 text-[12.5px] text-muted-foreground">
					{state.helper}
				</p>
			) : null}
			{state.body.kind !== "free-text" ? (
				<div
					className={cn(
						"mt-[11px] transition-opacity",
						// Typed text answers instead of the options; they dim but stay tappable.
						state.typingOverride && "opacity-[0.38]",
					)}
				>
					<TrayBodySlot body={state.body} callbacks={bodyCallbacks} />
				</div>
			) : null}
			{state.typingOverride ? (
				<p className="mt-2 text-[11.5px] text-ember-text">
					{t("appBuilder.chat.tray.typingOverride")}
				</p>
			) : null}
		</div>
	);
}
