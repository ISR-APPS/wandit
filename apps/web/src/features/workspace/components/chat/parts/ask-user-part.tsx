// In-thread rendering for one round of ask_user calls. The questions share a
// single transcript card while the interactive answer UI remains docked on the
// composer, one question at a time.

import { cn } from "@wandit/ui/lib/utils";
import { Check, ChevronDown, Paperclip } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import type { WanditUIMessage } from "../../../lib/use-ai-chat";
import { WanditMessageHeader } from "../real-message";
import { TrayPointerChip } from "../request-tray/tray-signals";
import { askAnswerValue } from "../request-tray/use-request-tray";

export type AskUserToolPart = Extract<
	WanditUIMessage["parts"][number],
	{ type: "tool-ask_user" }
>;

export function AskUserGroupCard({
	parts,
	activeAskToolCallId,
	ownsActiveAsk,
	isAfterActiveAsk,
	showHeader = true,
	defaultOpen = false,
}: {
	parts: AskUserToolPart[];
	activeAskToolCallId?: string;
	ownsActiveAsk: boolean;
	isAfterActiveAsk: boolean;
	/** MessageParts hoists one Wandit header per assistant turn — the card
	 * must not repeat it inside the same turn. */
	showHeader?: boolean;
	/** Initial expansion only — the card never auto-opens after mount. */
	defaultOpen?: boolean;
}) {
	const { t } = useTranslation();
	const activeAskIndex = parts.findIndex(
		(part) => part.toolCallId === activeAskToolCallId,
	);

	// Collapsible, CLOSED by default — the composer already carries the live
	// question, so the card starts as a one-line summary and only expands by
	// hand. It still folds back into the receipt when the round settles.
	const hasOpenAsk = parts.some(
		(part) =>
			part.state === "input-streaming" || part.state === "input-available",
	);
	// Skipped questions don't count as answered — "4/5 répondues" is honest.
	const answeredCount = parts.filter(
		(part) => part.state === "output-available" && !part.output.dismissed,
	).length;
	const [open, setOpen] = useState(defaultOpen);
	const previousHasOpenAsk = useRef(hasOpenAsk);

	useEffect(() => {
		if (previousHasOpenAsk.current !== hasOpenAsk) {
			previousHasOpenAsk.current = hasOpenAsk;
			if (!hasOpenAsk) setOpen(false);
		}
	}, [hasOpenAsk]);

	return (
		<div className="overflow-hidden rounded-[14px] border border-border bg-background">
			<div className="px-3.5 pt-3 pb-2.5">
				{showHeader ? <WanditMessageHeader /> : null}
				<button
					type="button"
					onClick={() => setOpen((value) => !value)}
					aria-expanded={open}
					className="flex w-full min-w-0 items-center gap-2 text-start"
				>
					<span className="min-w-0 truncate font-medium text-[13.5px] text-foreground">
						{t("workspace.chat.askUser.questionsTitle")}
					</span>
					<span
						dir="auto"
						className="ms-auto shrink-0 text-[11px] text-muted-foreground"
					>
						{open
							? t("workspace.chat.askUser.questionCount", {
									count: parts.length,
								})
							: t("workspace.chat.askUser.answeredCount", {
									answered: answeredCount,
									total: parts.length,
								})}
					</span>
					<ChevronDown
						aria-hidden
						className={cn(
							"size-3.5 shrink-0 text-muted-foreground transition-transform",
							open && "rotate-180",
						)}
					/>
				</button>
			</div>
			{open ? (
				<div className="divide-y divide-border border-border border-t">
					{parts.map((part, index) => {
						const question = part.input?.question;
						const isActive = part.toolCallId === activeAskToolCallId;
						const isPending =
							part.state === "input-streaming" ||
							part.state === "input-available";
						const isWaiting =
							!isActive &&
							ownsActiveAsk &&
							isPending &&
							(activeAskIndex >= 0 ? index > activeAskIndex : isAfterActiveAsk);
						const hasOptions = (part.input?.options ?? []).length > 0;

						return (
							<div key={part.toolCallId} className="px-3.5 py-3">
								{question ? (
									<p
										dir="auto"
										className="whitespace-pre-wrap break-words text-[14px] text-foreground leading-[1.5]"
									>
										{question}
									</p>
								) : null}
								{isActive ? (
									<TrayPointerChip
										icon={hasOptions ? "options" : "question"}
										label={t("workspace.chat.askUser.answerBelow")}
										className="mt-2"
									/>
								) : isWaiting ? (
									<p className="mt-2 text-[12.5px] text-muted-foreground/70">
										{t("workspace.chat.askUser.upNext")}
									</p>
								) : part.state === "output-available" ? (
									<AskReceiptLine output={part.output} />
								) : null}
							</div>
						);
					})}
				</div>
			) : null}
		</div>
	);
}

/** How the ask settled, in one quiet line (the design's "answered —
    collapses" state, translated to the thread). */
function AskReceiptLine({
	output,
}: {
	output: Extract<AskUserToolPart, { state: "output-available" }>["output"];
}) {
	const { t } = useTranslation();

	if (output.dismissed) {
		return (
			<p className="mt-2 text-[12.5px] text-muted-foreground">
				{t("workspace.chat.askUser.skipped")}
			</p>
		);
	}

	const value = askAnswerValue(output);
	if (value) {
		return (
			<p className="mt-2 flex items-center gap-[7px] text-[12.5px] text-muted-foreground">
				<span className="grid size-3.5 shrink-0 place-items-center rounded-full bg-success/16">
					<Check className="size-2 text-success" strokeWidth={3} />
				</span>
				<span dir="auto" className="min-w-0 truncate">
					{value}
				</span>
				{output.files?.length ? (
					<span className="flex shrink-0 items-center gap-1 text-[11.5px] text-muted-foreground/80">
						<Paperclip aria-hidden className="size-3" />
						{t("workspace.chat.tray.filesSent", {
							count: output.files.length,
						})}
					</span>
				) : null}
			</p>
		);
	}

	// Attachments ask settled with uploads — count receipt instead of text.
	if (output.files?.length) {
		return (
			<p className="mt-2 flex items-center gap-[7px] text-[12.5px] text-muted-foreground">
				<span className="grid size-3.5 shrink-0 place-items-center rounded-full bg-success/16">
					<Paperclip className="size-2 text-success" strokeWidth={3} />
				</span>
				{t("workspace.chat.tray.filesSent", { count: output.files.length })}
			</p>
		);
	}

	if (output.delegated) {
		return (
			<p className="mt-2 flex items-center gap-[7px] text-[12.5px] text-muted-foreground">
				<span
					aria-hidden
					className="size-3.5 shrink-0 rounded-full bg-gradient-ember"
				/>
				{t("workspace.chat.askUser.pickedForYou")}
			</p>
		);
	}

	return null;
}
