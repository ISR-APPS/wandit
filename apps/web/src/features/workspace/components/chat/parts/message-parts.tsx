import type { WanditUIMessage } from "../../../lib/use-ai-chat";
import { AskUserPart } from "./ask-user-part";
import { GeneratePagePart } from "./generate-page-part";
import { TextPart } from "./text-part";

const warnedPartTypes = new Set<string>();

export function MessageParts({
	message,
	isStreaming,
	activeAskToolCallId,
}: {
	message: WanditUIMessage;
	isStreaming: boolean;
	/** The ask_user call currently docked on the composer tray (if any) — its
	 * in-thread rendering shows a pointer chip instead of a receipt. */
	activeAskToolCallId?: string;
}) {
	// Only the turn that OWNS the docked ask marks its later pending asks as
	// waiting ("Up next"). Unanswered asks stranded in older messages keep
	// rendering nothing — the server repairs those on the next send.
	const ownsActiveAsk =
		activeAskToolCallId !== undefined &&
		message.parts.some(
			(part) =>
				part.type === "tool-ask_user" &&
				part.toolCallId === activeAskToolCallId,
		);

	return message.parts.map((part, index) => {
		const isLastPart = index === message.parts.length - 1;

		switch (part.type) {
			case "text":
				// An empty text part (the stream sends "text-start" before any
				// characters) would render a bare Wandit header next to the
				// thinking dots — skip it until it has content.
				if (!part.text) return null;
				return (
					<TextPart
						// biome-ignore lint/suspicious/noArrayIndexKey: message parts are ordered and text parts have no id
						key={`${message.id}:${index}`}
						messageRole={message.role}
						part={part}
						isStreaming={
							part.state === "streaming" || (isStreaming && isLastPart)
						}
					/>
				);
			case "tool-ask_user": {
				const isActive = part.toolCallId === activeAskToolCallId;
				return (
					<AskUserPart
						key={part.toolCallId}
						part={part}
						isActive={isActive}
						isWaiting={
							!isActive &&
							ownsActiveAsk &&
							(part.state === "input-streaming" ||
								part.state === "input-available")
						}
					/>
				);
			}
			case "tool-generate_page":
				return <GeneratePagePart key={part.toolCallId} part={part} />;
			case "tool-read_skill":
			case "tool-get_direction_candidates":
				// Server-side context tools — deliberately invisible in the thread
				// (the model narrates what it did in prose when it matters).
				return null;
			default:
				// Every future rich state (building, versions, media, credits, publish)
				// plugs into this registry as another typed message-part renderer.
				warnUnknownPart(part.type);
				return null;
		}
	});
}

function warnUnknownPart(type: string) {
	if (!import.meta.env.DEV || warnedPartTypes.has(type)) return;

	warnedPartTypes.add(type);
	console.warn(`[ai-chat] No renderer registered for message part: ${type}`);
}
