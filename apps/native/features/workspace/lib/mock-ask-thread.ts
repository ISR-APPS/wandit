// Dev-only scripted thread for the request tray — the mobile twin of the web
// MOCK_CHAT_THREAD_ENABLED pattern. The native transport (legacy POST + SSE)
// cannot carry ask_user tool calls yet (the worker runs plain streamText, no
// tools — see the /ai-stream migration seam in chat-screen.tsx), so this
// feeds the REAL derivation hook + tray components with scripted ChatMessage
// data: single-choice, then multi-select, then free-text, with receipts
// stacking as each ask settles. Only the data is fake — every component,
// hook and answer path is the production one.
//
// Flip MOCK_ASK_THREAD_ENABLED to false to restore the live backend thread.

import type { AskUserOutput, ChatMessage } from "@wandit/contracts";
import { useCallback, useState } from "react";

export const MOCK_ASK_THREAD_ENABLED = true;

const CHAT_ID = "mock-ask-chat";

/** Fixture rows are stamped relative to a fixed base so the thread is
    stable across renders. */
function at(seq: number) {
	return new Date(Date.UTC(2026, 6, 12, 9, 0, seq)).toISOString();
}

function textMessage(
	id: string,
	role: "user" | "assistant",
	text: string,
	seq: number,
): ChatMessage {
	return {
		id,
		chatId: CHAT_ID,
		role,
		parts: [{ type: "text", text, state: "done" }],
		metadata: null,
		seq,
		createdAt: at(seq),
	};
}

function askMessage(
	id: string,
	seq: number,
	prose: string | null,
	ask: {
		toolCallId: string;
		question: string;
		helper?: string;
		kind: "single-choice" | "multi-select" | "free-text";
		options?: { id: string; label: string }[];
	},
): ChatMessage {
	return {
		id,
		chatId: CHAT_ID,
		role: "assistant",
		parts: [
			...(prose ? [{ type: "text", text: prose, state: "done" }] : []),
			{
				type: "tool-ask_user",
				toolCallId: ask.toolCallId,
				state: "input-available",
				input: {
					question: ask.question,
					helper: ask.helper,
					kind: ask.kind,
					options: ask.options ?? [],
				},
			},
		],
		metadata: null,
		seq,
		createdAt: at(seq),
	};
}

const OPENING: ChatMessage[] = [
	textMessage(
		"mock-1",
		"user",
		"Build a landing page for my vintage watch shop — cash on delivery, Algiers.",
		1,
	),
	askMessage(
		"mock-2",
		2,
		"Nice niche — vintage sells on story and trust. Before I sketch directions, one thing decides the whole tone:",
		{
			toolCallId: "mock-ask-1",
			question: "Who is this page mainly for?",
			helper: "This sets the voice, the hero shot and the proof we lead with.",
			kind: "single-choice",
			options: [
				{ id: "collectors", label: "Collectors" },
				{ id: "gift-buyers", label: "Gift buyers" },
				{ id: "daily-wearers", label: "Daily wearers" },
			],
		},
	),
];

/** What the script appends after each ask settles, keyed by toolCallId. */
const NEXT_STEPS: Record<string, (seq: number) => ChatMessage> = {
	"mock-ask-1": (seq) =>
		askMessage("mock-3", seq, null, {
			toolCallId: "mock-ask-2",
			question: "Which sections should the page include?",
			helper: "Pick everything that applies — I'll order them for the story.",
			kind: "multi-select",
			options: [
				{ id: "reviews", label: "Customer reviews" },
				{ id: "cod-form", label: "COD order form" },
				{ id: "gallery", label: "Watch gallery" },
				{ id: "faq", label: "FAQ" },
			],
		}),
	"mock-ask-2": (seq) =>
		askMessage("mock-4", seq, null, {
			toolCallId: "mock-ask-3",
			question: "Anything I should know about the shop's story?",
			helper: "A line or two is plenty — or let me write one.",
			kind: "free-text",
		}),
	"mock-ask-3": (seq) =>
		textMessage(
			"mock-5",
			"assistant",
			"Perfect — that's everything I needed. Generating the first direction now.",
			seq,
		),
};

/** Scripted stand-in for the live chat: answering an ask settles its part in
    place (state → output-available) and appends the next scripted turn. */
export function useMockAskThread() {
	const [messages, setMessages] = useState<ChatMessage[]>(OPENING);

	const answerAskUser = useCallback(
		(toolCallId: string, output: AskUserOutput) => {
			setMessages((current) => {
				const settled = current.map((message) => ({
					...message,
					parts: message.parts.map((part) =>
						(part as { toolCallId?: unknown }).toolCallId === toolCallId
							? { ...part, state: "output-available", output }
							: part,
					),
				}));
				const nextSeq = (settled[settled.length - 1]?.seq ?? 0) + 1;
				const followUp = NEXT_STEPS[toolCallId]?.(nextSeq);
				return followUp ? [...settled, followUp] : settled;
			});
		},
		[],
	);

	// Plain sends just land as a user bubble — there is no model behind the
	// script, so the thread simply records them.
	const sendText = useCallback((text: string) => {
		setMessages((current) => {
			const nextSeq = (current[current.length - 1]?.seq ?? 0) + 1;
			return [
				...current,
				textMessage(`mock-user-${nextSeq}`, "user", text, nextSeq),
			];
		});
		return true;
	}, []);

	return { messages, answerAskUser, sendText };
}
