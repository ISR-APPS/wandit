// Derives the live request-tray state from the chat message list — the
// mobile twin of the web use-request-tray.ts, working over persisted
// ChatMessage parts instead of typed AI SDK stream parts. The rule: the LAST
// unanswered ask_user call of the LAST assistant message docks on the
// composer; everything else in the thread stays prose. Answering goes back
// through ONE callback (onAnswer) with the exact contract output shape, so
// the tray chips, the composer free-text path and the escape hatch all
// complete the same tool call the same way.

import type {
	AskUserOption,
	AskUserOutput,
	ChatMessage,
} from "@wandit/contracts";
import { useTranslation } from "@wandit/internationalization/react";
import { useCallback, useMemo, useState } from "react";

import {
	type AskUserThreadPart,
	parseAskUserParts,
} from "../../lib/chat-message";
import type { ChipOption, RequestTrayState, TrayReceipt } from "./tray-types";

/** How many settled questions stack above the active one. */
const MAX_RECEIPTS = 3;

// Stable empty selection — a fresh [] every render would defeat the state
// memo below (its deps compare by reference).
const NO_PICKS: string[] = [];

/* ---------- answer builders ----------
   One tiny function per way the ask can settle, so every call site sends the
   exact contract shape (askUserOutputSchema) instead of hand-rolled objects. */

export function pickAnswer(option: AskUserOption): AskUserOutput {
	return { selectedId: option.id, label: option.label };
}

export function multiAnswer(selections: AskUserOption[]): AskUserOutput {
	return { selections };
}

export function freeTextAnswer(text: string): AskUserOutput {
	return { text };
}

/** "Decide for me" — the model picks confidently and says what it picked. */
export function delegateAnswer(): AskUserOutput {
	return { delegated: true };
}

/** Tray X — "skip, continue" (the question is logged, never lost). */
export function dismissAnswer(): AskUserOutput {
	return { dismissed: true };
}

/* ---------- derivation helpers (pure) ---------- */

/** The ask currently waiting on the user: the last ask_user part of the last
    assistant message that hasn't produced an output yet. */
export function findActiveAsk(
	messages: ChatMessage[],
): { part: AskUserThreadPart; messageIndex: number } | null {
	const lastIndex = messages.length - 1;
	const last = messages[lastIndex];
	if (last?.role !== "assistant") return null;

	const asks = parseAskUserParts(last.parts);
	for (let i = asks.length - 1; i >= 0; i--) {
		const part = asks[i];
		if (!part) continue;
		if (part.state === "input-streaming" || part.state === "input-available") {
			return { part, messageIndex: lastIndex };
		}
		// This ask is settled — keep scanning older siblings. The model can
		// emit several ask_user calls in one turn; if the user answers the
		// newest first, an older one may still be waiting, and it must dock
		// next or the agent's continuation (which needs EVERY call answered)
		// never fires.
	}
	return null;
}

/** One-line summary of an answer, for receipts here and in the thread. */
export function askAnswerValue(output: AskUserOutput): string {
	return (
		output.text ??
		output.label ??
		output.selections?.map((s) => s.label).join(" · ") ??
		""
	);
}

/** Walk backward from the active ask and collect the run of questions the
    user just answered (a queue collapses into stacked receipts). The run
    ends at the first assistant message with no ask_user in it — ordinary
    prose means the conversation moved on. */
export function collectReceipts(
	messages: ChatMessage[],
	activeMessageIndex: number,
): TrayReceipt[] {
	const receipts: TrayReceipt[] = []; // newest first while walking backward

	for (let i = activeMessageIndex; i >= 0; i--) {
		const message = messages[i];
		if (message?.role !== "assistant") continue;

		const askParts = parseAskUserParts(message.parts);
		if (askParts.length === 0 && i !== activeMessageIndex) break;

		// Within one message, newest part last — reverse so the walk stays
		// strictly newest-first.
		for (const part of [...askParts].reverse()) {
			if (part.state !== "output-available" || !part.output) continue;
			// Dismissed asks were skipped, not answered — no receipt.
			if (part.output.dismissed) continue;
			receipts.push({
				kind: part.output.delegated ? "delegated" : "answered",
				label: part.input?.question ?? "",
				value: askAnswerValue(part.output),
			});
		}
	}

	// Cap to the newest few, then flip to oldest-first for display.
	return receipts.slice(0, MAX_RECEIPTS).reverse();
}

/* ---------- the hook ---------- */

export function useRequestTray({
	messages,
	composerText,
	enabled = true,
	onAnswer,
}: {
	messages: ChatMessage[];
	composerText: string;
	/** Master switch — off = the tray never docks (derivation is skipped). */
	enabled?: boolean;
	/** Completes the tool call with the built output shape. */
	onAnswer: (toolCallId: string, output: AskUserOutput) => void;
}) {
	const { t } = useTranslation();
	const active = useMemo(
		() => (enabled ? findActiveAsk(messages) : null),
		[enabled, messages],
	);
	const toolCallId = active?.part.toolCallId;

	// Multi-select picks live here (not in the body component) so the confirm
	// button can read them; keyed by toolCallId so a new ask starts clean.
	const [multiPicks, setMultiPicks] = useState<{
		toolCallId: string;
		ids: string[];
	} | null>(null);
	const selectedIds =
		multiPicks && multiPicks.toolCallId === toolCallId
			? multiPicks.ids
			: NO_PICKS;

	const state = useMemo<RequestTrayState | null>(() => {
		if (!active) return null;
		const { part } = active;
		const streaming = part.state === "input-streaming";
		const question = part.input?.question || undefined;
		const helper = part.input?.helper ?? undefined;
		const options: ChipOption[] = part.input?.options ?? [];

		// Explicit kind wins; old asks (no kind) derive it from the options:
		// none → free-text, some → single-choice.
		const kind =
			part.input?.kind ??
			(options.length === 0 ? "free-text" : "single-choice");

		// While the input is still streaming the options are half-parsed — show
		// the question growing with a spinner and no chips until input-available.
		const body: RequestTrayState["body"] = streaming
			? { kind: "free-text" }
			: kind === "multi-select"
				? { kind: "multi-select", options, selectedIds }
				: kind === "single-choice"
					? { kind: "single-choice", options }
					: { kind: "free-text" };

		return {
			badge: streaming ? "spinner" : "question",
			label: streaming
				? t("native.workspace.chat.tray.preparing")
				: t("native.workspace.chat.tray.needsDetail"),
			question,
			helper,
			escape: { label: t("native.workspace.chat.tray.decideForMe") },
			receipts: collectReceipts(messages, active.messageIndex),
			body,
			// Typed text beats the chips — only meaningful when there ARE chips
			// to dim.
			typingOverride: composerText.trim().length > 0 && options.length > 0,
		};
	}, [active, messages, composerText, selectedIds, t]);

	const answer = useCallback(
		(output: AskUserOutput) => {
			// Only a fully-arrived ask may be answered: writing an output onto a
			// part whose input is still streaming would race the incoming chunks.
			if (!toolCallId || active?.part.state !== "input-available") return;
			onAnswer(toolCallId, output);
			setMultiPicks(null);
		},
		[toolCallId, active, onAnswer],
	);

	// Single-choice answers immediately on tap — one tap, done.
	const onPick = useCallback(
		(option: ChipOption) => answer(pickAnswer(option)),
		[answer],
	);

	const onToggleMulti = useCallback(
		(id: string) => {
			if (!toolCallId) return;
			setMultiPicks((current) => {
				const ids =
					current && current.toolCallId === toolCallId ? current.ids : [];
				return {
					toolCallId,
					ids: ids.includes(id)
						? ids.filter((item) => item !== id)
						: [...ids, id],
				};
			});
		},
		[toolCallId],
	);

	// Confirm — send the picked options with their labels intact.
	const onConfirmMulti = useCallback(() => {
		const options = active?.part.input?.options ?? [];
		const selections = options.filter((option) =>
			selectedIds.includes(option.id),
		);
		if (selections.length > 0) answer(multiAnswer(selections));
	}, [active, selectedIds, answer]);

	const answerFreeText = useCallback(
		(text: string) => answer(freeTextAnswer(text)),
		[answer],
	);
	const delegate = useCallback(() => answer(delegateAnswer()), [answer]);
	const dismiss = useCallback(() => answer(dismissAnswer()), [answer]);

	return {
		/** True while an ask is docked — including its streaming preamble. */
		active: Boolean(active),
		/** Only input-available asks may be answered; a streaming input hasn't
		    fully arrived yet. */
		answerable: active?.part.state === "input-available",
		toolCallId,
		state,
		// Body interactivity, threaded through RequestTray → TrayBodySlot.
		onPick,
		multiSelectedIds: selectedIds,
		onToggleMulti,
		onConfirmMulti,
		// Whole-ask actions.
		answerFreeText,
		delegate,
		dismiss,
	};
}
