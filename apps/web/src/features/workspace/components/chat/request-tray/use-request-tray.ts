// Derives the live request-tray state from the AI SDK message list — the
// bridge between stream parts and the display types in types.ts. The rule
// (design turn 10): the LAST unanswered ask_user call of the LAST assistant
// message docks on the composer; everything else in the thread stays prose.
// Answering goes back through ONE callback (answerAskUser in use-ai-chat.ts)
// with the output shape built here, so the tray, the composer free-text path
// and the escape hatch all complete the same tool call the same way.

import type { AskUserOption, AskUserOutput } from "@wandit/contracts";
import { useCallback, useMemo, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import type { WanditUIMessage } from "../../../lib/use-ai-chat";
import type { ChipOption, RequestTrayState } from "./types";

type AskUserToolPart = Extract<
	WanditUIMessage["parts"][number],
	{ type: "tool-ask_user" }
>;

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
	messages: WanditUIMessage[],
): AskUserToolPart | null {
	const lastIndex = messages.length - 1;
	const last = messages[lastIndex];
	if (last?.role !== "assistant") return null;

	for (let i = last.parts.length - 1; i >= 0; i--) {
		const part = last.parts[i];
		if (part?.type !== "tool-ask_user") continue;
		if (part.state === "input-streaming" || part.state === "input-available") {
			return part;
		}
		// This ask is settled — keep scanning older siblings. The model can
		// emit several ask_user calls in one turn; if the user answers the
		// newest first, an older one may still be waiting, and it must dock
		// next or auto-resubmit (which needs EVERY call answered) never fires.
	}
	return null;
}

/** One-line summary of an answer for the settled ask shown in the thread. */
export function askAnswerValue(output: AskUserOutput): string {
	return (
		output.text ??
		output.label ??
		output.selections?.map((s) => s.label).join(" · ") ??
		""
	);
}

/* ---------- the hook ---------- */

export function useRequestTray({
	messages,
	composerText,
	onAnswer,
}: {
	messages: WanditUIMessage[];
	composerText: string;
	/** answerAskUser from use-ai-chat — completes the tool call. */
	onAnswer: (toolCallId: string, output: AskUserOutput) => void;
}) {
	const { t } = useTranslation();
	const active = useMemo(() => findActiveAsk(messages), [messages]);
	const toolCallId = active?.toolCallId;

	// Choice drafts live above the bodies so the PromptBox CTA can validate and
	// confirm them. Keying by toolCallId prevents a queued ask from inheriting
	// the previous question's selection.
	const [singlePick, setSinglePick] = useState<{
		toolCallId: string;
		id: string;
	} | null>(null);
	const selectedId =
		singlePick && singlePick.toolCallId === toolCallId
			? singlePick.id
			: undefined;

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
		const streaming = active.state === "input-streaming";
		const question = active.input?.question ?? undefined;
		const helper = active.input?.helper ?? undefined;
		const options = (active.input?.options ?? []).flatMap<ChipOption>(
			(option) =>
				option?.id && option.label
					? [{ id: option.id, label: option.label }]
					: [],
		);

		// Explicit kind wins; old asks (no kind) derive it from the options:
		// none → free-text, some → single-choice.
		const kind =
			active.input?.kind ??
			(options.length === 0 ? "free-text" : "single-choice");

		// While the input is still streaming the options are half-parsed — show
		// the question growing with a spinner and no chips until input-available.
		const body: RequestTrayState["body"] = streaming
			? { kind: "free-text" }
			: kind === "multi-select"
				? { kind: "multi-select", options, selectedIds }
				: kind === "single-choice"
					? { kind: "single-choice", options, selectedId }
					: { kind: "free-text" };

		return {
			badge: streaming ? "spinner" : "question",
			label: streaming
				? t("workspace.chat.tray.preparing")
				: t("workspace.chat.tray.needsDetail"),
			question,
			helper,
			escape: {
				label: t("workspace.chat.tray.decideForMe"),
				icon: "shuffle",
			},
			body,
			// Typed text beats the chips (design 10n state 2) — only meaningful
			// when there ARE chips to dim.
			typingOverride: composerText.trim().length > 0 && options.length > 0,
		};
	}, [active, composerText, selectedId, selectedIds, t]);

	const answer = useCallback(
		(output: AskUserOutput) => {
			// Only a fully-arrived ask may be answered: writing an output onto a
			// part whose input is still streaming would race the incoming chunks.
			if (!toolCallId || active?.state !== "input-available") return;
			onAnswer(toolCallId, output);
			setSinglePick(null);
			setMultiPicks(null);
		},
		[toolCallId, active, onAnswer],
	);

	const onPick = useCallback(
		(option: ChipOption) => {
			if (!toolCallId) return;
			setSinglePick({ toolCallId, id: option.id });
		},
		[toolCallId],
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

	const onConfirmMulti = useCallback(() => {
		const options = active?.input?.options ?? [];
		const selections = options.flatMap<AskUserOption>((option) =>
			option?.id && option.label && selectedIds.includes(option.id)
				? [{ id: option.id, label: option.label }]
				: [],
		);
		if (selections.length > 0) answer(multiAnswer(selections));
	}, [active, selectedIds, answer]);

	const onConfirmSingle = useCallback(() => {
		const option = (active?.input?.options ?? []).find(
			(candidate) => candidate?.id === selectedId,
		);
		if (option?.id && option.label) {
			answer(pickAnswer({ id: option.id, label: option.label }));
		}
	}, [active, selectedId, answer]);

	const answerFreeText = useCallback(
		(text: string) => answer(freeTextAnswer(text)),
		[answer],
	);
	const delegate = useCallback(() => answer(delegateAnswer()), [answer]);
	const dismiss = useCallback(() => answer(dismissAnswer()), [answer]);

	// Typed text wins over any chip draft. That preserves the existing
	// free-form override while every answer mode now confirms through one CTA.
	const trimmedComposerText = composerText.trim();
	const answerMode = trimmedComposerText
		? "text"
		: state?.body.kind === "single-choice"
			? "single"
			: state?.body.kind === "multi-select"
				? "multi"
				: "text";
	const canConfirm =
		active?.state === "input-available" &&
		(answerMode === "text"
			? trimmedComposerText.length > 0
			: answerMode === "single"
				? Boolean(selectedId)
				: selectedIds.length > 0);
	const confirmDraft = useCallback(() => {
		if (!canConfirm) return false;
		if (trimmedComposerText) {
			answerFreeText(trimmedComposerText);
		} else if (answerMode === "single") {
			onConfirmSingle();
		} else {
			onConfirmMulti();
		}
	}, [
		canConfirm,
		trimmedComposerText,
		answerFreeText,
		answerMode,
		onConfirmSingle,
		onConfirmMulti,
	]);

	return {
		/** True while an ask is docked — including its streaming preamble. */
		active: Boolean(active),
		/** Only input-available asks may be answered; a streaming input hasn't
		    fully arrived yet and the composer is disabled anyway. */
		answerable: active?.state === "input-available",
		toolCallId,
		state,
		// Body interactivity, threaded through RequestTray → TrayBodySlot.
		onPick,
		multiSelectedIds: selectedIds,
		onToggleMulti,
		answerMode,
		canConfirm,
		selectedCount:
			answerMode === "single" ? (selectedId ? 1 : 0) : selectedIds.length,
		confirmDraft,
		// Whole-ask actions.
		answerFreeText,
		delegate,
		dismiss,
	};
}
