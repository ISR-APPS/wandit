/**
 * The details panel of one assistant reply: every step of the turn (thought
 * rows without their text, step rows with their images, the notes of the
 * agent) and then the changed files. pages/app-builder-page.tsx renders it
 * over the main card on desktop and in a sheet on a phone. Also exports the
 * work summary label and the changed files list that chat-message.tsx uses.
 */

import { Button } from "@wandit/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";
import { FilePen, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Streamdown } from "streamdown";

import { useTranslation } from "@/lib/i18n";
import type { BuilderDataParts, BuilderMessage } from "../../api/dto";
import { isActivityPart, workedDurationOf } from "../../lib/turn-parts";
import { useAutoScroll } from "../../lib/use-auto-scroll";
import { StepRow } from "./step-row";
import { ThoughtRow } from "./thought-row";

/** Props of the details panel, as pages/app-builder-page.tsx passes them. */
export type ActivityPanelProps = {
	/** The assistant reply whose steps show. */
	message: BuilderMessage;
	/** True while this reply streams. The list then follows new rows, and the header dot pulses. */
	isLive: boolean;
	/** Closes the panel. The close button and the Escape key call it. */
	onClose: () => void;
	className?: string;
};

/** The steps of one reply, its work summary, and its changed files. Escape closes it. */
export function ActivityPanel({
	message,
	isLive,
	onClose,
	className,
}: ActivityPanelProps) {
	const { t } = useTranslation();
	const listRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const summary = summaryOf(message);

	useAutoScroll(listRef, contentRef, isLive);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			// A Radix layer that closes on Escape calls preventDefault. Only a free Escape closes the panel.
			if (event.key === "Escape" && !event.defaultPrevented) onClose();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [onClose]);

	return (
		<div className={cn("flex min-h-0 flex-col", className)}>
			<div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
				<span className="font-medium text-[15px]">
					{t("appBuilder.chat.details")}
				</span>
				{summary !== null ? (
					<span className="min-w-0 truncate text-[13px] text-muted-foreground">
						· <WorkSummaryLabel summary={summary} />
					</span>
				) : null}
				{isLive ? (
					// Decorative only: the status line in the chat carries role="status".
					<span
						aria-hidden
						className="size-[7px] shrink-0 animate-pulse-soft rounded-full bg-primary"
					/>
				) : null}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon-sm"
							className="ms-auto"
							aria-label={t("appBuilder.chat.activity.close")}
							onClick={onClose}
						>
							<X className="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						{t("appBuilder.chat.activity.close")}
					</TooltipContent>
				</Tooltip>
			</div>
			<div
				ref={listRef}
				className="scroll-warm min-h-0 flex-1 overflow-y-auto px-4 py-4"
			>
				<div ref={contentRef} className="flex flex-col">
					{message.parts.filter(isActivityPart).map((part, index) => {
						// Activity parts carry no stable id. They only append, so the index is stable.
						const key = `${message.id}-${index}`;
						if (part.type === "data-thought") {
							// Raw thinking never shows in production, so the row gets no text and no chevron.
							return (
								<ThoughtRow
									key={key}
									text=""
									seconds={part.data.seconds}
									isStreaming={part.data.isStreaming}
								/>
							);
						}
						if (part.type === "data-step") {
							return <StepRow key={key} {...part.data} />;
						}
						// The third activity kind: a note the agent wrote between its steps.
						return (
							<Streamdown
								key={key}
								dir="auto"
								className="space-y-2 break-words py-1 text-[13px] text-muted-foreground leading-relaxed"
							>
								{part.data.text}
							</Streamdown>
						);
					})}
					{summary !== null && summary.files.length > 0 ? (
						<section>
							<h3 className="mt-4 mb-1 font-medium text-muted-foreground text-xs">
								{t("appBuilder.chat.summary.changedFiles")}
							</h3>
							<ChangedFiles files={summary.files} />
						</section>
					) : null}
				</div>
			</div>
		</div>
	);
}

/** The `data-summary` payload of a reply, or null when the reply has none (an old row, a failed or a stopped turn). */
export function summaryOf(
	message: BuilderMessage,
): BuilderDataParts["summary"] | null {
	return (
		message.parts.find((part) => part.type === "data-summary")?.data ?? null
	);
}

/**
 * The work summary text, for example "Worked for 2 min · 3 files changed".
 * The chat line, the panel header, and the developer view show it. Null
 * `summary` gives the "See what Wandit did" fallback.
 */
export function WorkSummaryLabel({
	summary,
}: {
	/** Work time and changed files of the turn, from `summaryOf`. */
	summary: BuilderDataParts["summary"] | null;
}) {
	const { t } = useTranslation();
	if (summary === null) return t("appBuilder.chat.summary.fallback");
	const duration = workedDurationOf(summary.workedSeconds);
	const worked =
		duration.unit === "seconds"
			? t("appBuilder.chat.summary.workedSeconds", { count: duration.count })
			: t("appBuilder.chat.summary.workedMinutes", { count: duration.count });
	if (summary.files.length === 0) return worked;
	return `${worked} · ${t("appBuilder.chat.summary.files", { count: summary.files.length })}`;
}

/**
 * One row per changed file: the file name, its folder, and the added and
 * removed line counts from git numstat. A git rename path (`old => new`)
 * shows whole, because a split at the last slash cuts it in a wrong place.
 */
export function ChangedFiles({
	files,
}: {
	/** Changed files of the turn commit, from the `data-summary` part. */
	files: BuilderDataParts["summary"]["files"];
}) {
	return (
		<ul className="flex flex-col">
			{files.map((file) => {
				const slashIndex = file.path.includes(" => ")
					? -1
					: file.path.lastIndexOf("/");
				const name = file.path.slice(slashIndex + 1);
				const folder = slashIndex === -1 ? "" : file.path.slice(0, slashIndex);
				return (
					<li
						key={file.path}
						className="flex min-h-8 min-w-0 items-center gap-2.5 py-1 text-sm"
					>
						<FilePen
							className="size-4 shrink-0 text-muted-foreground"
							aria-hidden
						/>
						<span
							dir="ltr"
							className="flex min-w-0 items-baseline gap-1.5 font-mono text-[12px]"
						>
							<span className="max-w-full shrink-0 truncate">{name}</span>
							<span className="min-w-0 truncate text-muted-foreground">
								{folder}
							</span>
						</span>
						<span
							dir="ltr"
							className="ms-auto shrink-0 font-mono text-xs tabular-nums"
						>
							<span className="text-success-text">+{file.insertions}</span>{" "}
							<span className="text-destructive">−{file.deletions}</span>
						</span>
					</li>
				);
			})}
		</ul>
	);
}
