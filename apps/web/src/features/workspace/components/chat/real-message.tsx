// Renders one real chat message (contract shape: role + AI SDK UIMessage
// parts). Only text parts are shown — any other part type is ignored
// gracefully. Styling follows DESIGN.md "Chat Message Bubbles": user turns
// right-align in a tinted bubble with one squared corner; Wandit turns have
// no bubble — a 22px ember-gradient avatar + name row over plain body text.

import type { ChatMessage, MessageRole } from "@wandit/contracts";
import remarkBreaks from "remark-breaks";
import { defaultRemarkPlugins, Streamdown } from "streamdown";

import { Spark } from "@/components/logo";

// Custom remarkPlugins REPLACE Streamdown's defaults (GFM tables included),
// so re-spread them and append remark-breaks: single newlines become hard
// breaks (chat convention, and what all the pre-Markdown history written as
// plain text expects).
const REMARK_PLUGINS = [...Object.values(defaultRemarkPlugins), remarkBreaks];

/** Concatenate the text of every `{ type: "text", text }` part; ignore rest. */
export function extractMessageText(parts: ChatMessage["parts"]): string {
	let text = "";
	for (const part of parts) {
		if (
			part &&
			typeof part === "object" &&
			(part as { type?: unknown }).type === "text"
		) {
			const value = (part as { text?: unknown }).text;
			if (typeof value === "string") text += value;
		}
	}
	return text;
}

/** The 22px ember-gradient assistant avatar + "Wandit" name row. */
export function WanditMessageHeader({ meta }: { meta?: string }) {
	return (
		<div className="mb-2 flex items-center gap-2">
			<span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-gradient-ember">
				<Spark className="size-3 text-background" />
			</span>
			<span className="font-medium text-foreground text-sm">Wandit</span>
			{meta ? (
				<span className="ms-auto text-muted-foreground text-xs">{meta}</span>
			) : null}
		</div>
	);
}

export function RealChatMessage({
	messageRole,
	text,
	isStreaming = false,
	showHeader = true,
}: {
	messageRole: MessageRole;
	text: string;
	isStreaming?: boolean;
	/** In the workspace thread the turn wrapper renders one header for the
	 * whole message; standalone renders (history, tests) keep their own. */
	showHeader?: boolean;
}) {
	if (!text && !isStreaming) return null;

	if (messageRole === "user") {
		return (
			<div className="flex justify-end">
				<div
					dir="auto"
					className="max-w-[86%] whitespace-pre-wrap break-words rounded-[18px] rounded-ee-[6px] border border-border bg-bubble px-3.5 py-2.5 text-[14.5px] text-foreground leading-[1.45]"
				>
					{text}
				</div>
			</div>
		);
	}

	return (
		<div>
			{showHeader ? <WanditMessageHeader /> : null}
			<Streamdown
				dir="auto"
				mode="streaming"
				isAnimating={isStreaming}
				caret="block"
				remarkPlugins={REMARK_PLUGINS}
				// Long tables cap at ~10 visible rows and scroll internally (the
				// header stays pinned); the full set lives behind the toolbar's
				// fullscreen control. Short tables render whole, unchanged. The
				// fullscreen overlay portals to <body>, outside this scope.
				className="space-y-2.5 break-words text-[14.5px] text-foreground leading-[1.55] [&_[data-streamdown=table-header]]:sticky [&_[data-streamdown=table-header]]:top-0 [&_[data-streamdown=table-header]]:z-[1] [&_[data-streamdown=table-header]]:bg-muted [&_[data-streamdown=table-header]]:shadow-[0_1px_0_0_var(--color-border)] [&_[data-streamdown=table-wrapper]>div:last-child]:max-h-[420px] [&_ol]:space-y-1 [&_table]:my-1 [&_ul]:space-y-1"
			>
				{text}
			</Streamdown>
		</div>
	);
}
