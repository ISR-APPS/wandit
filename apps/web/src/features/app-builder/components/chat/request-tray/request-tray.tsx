/**
 * The request tray opens on top of the composer when the agent asks a question.
 * Its head shows the label, the step count, "Decide for me", and the skip X.
 * Under it sit the question, its helper, and the answer body (tray-bodies.tsx).
 * Rendered by chat-pane.tsx; lib/use-request-tray.ts builds the state.
 */

import { ImageIcon } from "@phosphor-icons/react/Image";
import { QuestionIcon } from "@phosphor-icons/react/Question";
import { XIcon } from "@phosphor-icons/react/X";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";
import { IconAction } from "../../shell/top-bar";
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
		<div className="border-night/[0.07] border-b bg-secondary px-4 pt-3 pb-3.5 dark:border-white/[0.07]">
			<div className="flex items-center gap-2">
				<span
					aria-hidden
					className="grid size-6 shrink-0 place-items-center rounded-full bg-spark/[0.2] text-spark-deep dark:bg-spark/[0.16] dark:text-spark"
				>
					{state.badge === "media" ? (
						<ImageIcon weight="duotone" className="size-3.5" />
					) : (
						<QuestionIcon weight="duotone" className="size-3.5" />
					)}
				</span>
				<span className="min-w-0 truncate font-grotesk font-medium text-[12px] text-ember-text">
					{state.label}
				</span>
				<div className="ms-auto flex shrink-0 items-center gap-1.5">
					{state.step !== null ? (
						<span className="font-grotesk text-[12px] text-night/45 tabular-nums dark:text-foreground/45">
							{t("appBuilder.chat.tray.step", {
								current: state.step.current,
								total: state.step.total,
							})}
						</span>
					) : null}
					<button
						type="button"
						onClick={onDelegate}
						className="flex h-7 items-center rounded-full border border-night/[0.12] px-3 font-grotesk font-medium text-[12px] text-night/70 outline-none transition-colors duration-150 hover:bg-night/[0.05] hover:text-night focus-visible:ring-2 focus-visible:ring-ember/30 dark:border-white/[0.12] dark:text-foreground/70 dark:hover:bg-white/[0.06] dark:hover:text-foreground"
					>
						{t("appBuilder.chat.tray.decideForMe")}
					</button>
					<IconAction label={t("appBuilder.chat.tray.dismiss")}>
						<button
							type="button"
							onClick={onDismiss}
							className="grid size-7 place-items-center rounded-full text-night/45 outline-none transition-colors duration-150 hover:bg-night/[0.06] hover:text-night focus-visible:ring-2 focus-visible:ring-ember/30 dark:text-foreground/45 dark:hover:bg-white/[0.08] dark:hover:text-foreground"
						>
							<XIcon weight="bold" className="size-3.5" aria-hidden />
						</button>
					</IconAction>
				</div>
			</div>
			{/* Polite: each new step of a round reads out without a focus move. */}
			<p
				dir="auto"
				aria-live="polite"
				className="mt-2.5 font-grotesk font-semibold text-[15px] text-night leading-snug dark:text-foreground"
			>
				{state.question}
			</p>
			{state.helper !== null ? (
				<p
					dir="auto"
					className="mt-1 font-sans text-[13px] text-night/60 leading-snug dark:text-foreground/60"
				>
					{state.helper}
				</p>
			) : null}
			{state.body.kind !== "free-text" ? (
				<div
					className={cn(
						"mt-3 transition-opacity",
						// Typed text answers instead of the options; they dim but stay tappable.
						state.typingOverride && "opacity-[0.38]",
					)}
				>
					<TrayBodySlot body={state.body} callbacks={bodyCallbacks} />
				</div>
			) : null}
			{state.typingOverride ? (
				<p className="mt-2 font-grotesk text-[12px] text-ember-text">
					{t("appBuilder.chat.tray.typingOverride")}
				</p>
			) : null}
		</div>
	);
}
