// Renders one real chat message (contract shape: role + AI SDK UIMessage
// parts). Only text parts are shown — any other part type is ignored
// gracefully. Styling follows DESIGN.md "Chat Message Bubbles": user turns
// right-align in a tinted bubble with one squared corner; Wandit turns have
// no bubble — a 22px ember-gradient avatar + name row over plain body text.

import type { ChatMessage, MessageRole } from "@wandit/contracts";
import { cn } from "@wandit/ui/lib/utils";

import { Spark } from "@/components/logo";

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
}: {
	messageRole: MessageRole;
	text: string;
	isStreaming?: boolean;
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
			<WanditMessageHeader />
			<p
				dir="auto"
				className="whitespace-pre-wrap break-words text-[14.5px] text-foreground leading-[1.55]"
			>
				{text}
				{isStreaming ? (
					<span
						aria-hidden
						className={cn(
							"ms-0.5 inline-block h-3 w-[2px] translate-y-0.5 animate-caret rounded-full bg-foreground",
						)}
					/>
				) : null}
			</p>
		</div>
	);
}
