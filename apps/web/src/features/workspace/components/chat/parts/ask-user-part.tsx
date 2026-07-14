// In-thread rendering of an ask_user call. The thread stays PROSE (design
// turn 10: "instead of pushing option cards into the thread, they dock on the
// composer") — so this shows the question text plus either a pointer chip at
// the docked tray (while the ask is active) or a compact receipt of how it
// settled. The interactive chips live ONLY in the request tray now.
// Chrome strings hardcoded English this pass, same rule as the tray files.

import { Check } from "lucide-react";

import type { WanditUIMessage } from "../../../lib/use-ai-chat";
import { WanditMessageHeader } from "../real-message";
import { TrayPointerChip } from "../request-tray/tray-signals";
import { askAnswerValue } from "../request-tray/use-request-tray";

type AskUserToolPart = Extract<
	WanditUIMessage["parts"][number],
	{ type: "tool-ask_user" }
>;

export function AskUserPart({
	part,
	isActive,
	isWaiting,
}: {
	part: AskUserToolPart;
	/** True when this ask is the one docked on the composer right now. */
	isActive: boolean;
	/** True for a still-pending sibling queued BEHIND the active ask (multi-
	    question turns step through them oldest first) — it renders a quiet
	    waiting note instead of the pointer, so only ONE part points at the
	    tray. Stale unanswered asks in older turns stay false and render
	    nothing, exactly as before. */
	isWaiting?: boolean;
}) {
	const question = part.input?.question;
	const hasOptions = (part.input?.options ?? []).length > 0;

	return (
		<div>
			<WanditMessageHeader />
			{question ? (
				<p
					dir="auto"
					className="whitespace-pre-wrap break-words text-[14.5px] text-foreground leading-[1.5]"
				>
					{question}
				</p>
			) : null}
			{isActive ? (
				<TrayPointerChip
					icon={hasOptions ? "options" : "question"}
					label={
						hasOptions ? "Pick below · on the composer ↓" : "Answer below ↓"
					}
					className="mt-2"
				/>
			) : isWaiting ? (
				<p className="mt-2 text-[12.5px] text-muted-foreground/70">Up next</p>
			) : part.state === "output-available" ? (
				<AskReceiptLine output={part.output} />
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
	if (output.dismissed) {
		return <p className="mt-2 text-[12.5px] text-muted-foreground">Skipped</p>;
	}

	if (output.delegated) {
		return (
			<p className="mt-2 flex items-center gap-[7px] text-[12.5px] text-muted-foreground">
				<span
					aria-hidden
					className="size-3.5 shrink-0 rounded-full bg-gradient-ember"
				/>
				Wandit picked for you
			</p>
		);
	}

	const value = askAnswerValue(output);
	if (!value) return null;

	return (
		<p className="mt-2 flex items-center gap-[7px] text-[12.5px] text-muted-foreground">
			<span className="grid size-3.5 shrink-0 place-items-center rounded-full bg-success/16">
				<Check className="size-2 text-success" strokeWidth={3} />
			</span>
			<span dir="auto" className="min-w-0 truncate">
				{value}
			</span>
		</p>
	);
}
