// Renders one real chat message (contract shape: role + AI SDK UIMessage
// parts). Only text parts are shown — any other part type is ignored
// gracefully. Mirrors the mock ChatMessageView styling so the streaming test
// UI matches the rest of the workspace.

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
					className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-ee-md border border-border/60 bg-secondary px-3.5 py-2.5 text-sm leading-relaxed"
				>
					{text}
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2.5">
			<div className="flex items-center gap-1.5">
				<Spark className="size-3 text-primary" />
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
					wandit
				</span>
			</div>
			<p
				dir="auto"
				className="whitespace-pre-wrap break-words text-foreground/90 text-sm leading-relaxed"
			>
				{text}
				{isStreaming ? (
					<span
						aria-hidden
						className={cn(
							"ms-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse rounded-full bg-primary",
						)}
					/>
				) : null}
			</p>
		</div>
	);
}
