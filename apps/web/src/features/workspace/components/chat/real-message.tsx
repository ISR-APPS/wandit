// Renders one real chat message (contract shape: role + AI SDK UIMessage
// parts). Only text parts are shown — any other part type is ignored
// gracefully. Mirrors the mock ChatMessageView styling so the streaming test
// UI matches the rest of the workspace.

/**
 * WHERE THIS FILE SITS IN THE CHAT FLOW (end of the pipeline, display only):
 *
 *   worker calls the AI model → streams events to Redis → the API relays them
 *   to the browser over SSE → use-project-chat.tsx collects them into messages
 *   → chat-pane.tsx maps each message to <RealChatMessage> (this file).
 *
 * chat-pane.tsx uses this file in two ways:
 *   1. For every PERSISTED message it calls extractMessageText(message.parts)
 *      to flatten the message into a plain string, then renders it.
 *   2. For the one IN-FLIGHT assistant message it passes the partial text it
 *      has received so far plus isStreaming, so we show a blinking caret.
 *
 * "Real" in the name distinguishes this from the older mock ChatMessageView
 * that rendered hardcoded demo messages. This component is purely visual: no
 * state, no data fetching — it just draws whatever text it is given.
 */

// ChatMessage / MessageRole come from the shared @wandit/contracts package.
// Those types are inferred from Zod schemas (Zod = a library that describes
// data shapes and validates them at runtime), so the web app and the NestJS
// API agree on exactly what a chat message looks like.
import type { ChatMessage, MessageRole } from "@wandit/contracts";
// cn() is the usual shadcn/Tailwind helper: it joins class-name strings and
// resolves conflicting Tailwind classes (last one wins).
import { cn } from "@wandit/ui/lib/utils";

// Spark is the small Wandit logo mark, used to label assistant messages.
import { Spark } from "@/components/logo";

/** Concatenate the text of every `{ type: "text", text }` part; ignore rest. */
// Background: the AI SDK stores a message body as an array of "parts" — text
// parts, tool-call parts, reasoning parts, etc. Our contract deliberately types
// `parts` very loosely (an array of `Record<string, unknown>` in Zod terms), so
// TypeScript can't guarantee anything about a part's shape at compile time.
// That's why this function checks everything by hand at runtime instead of
// trusting the types. Any part that isn't `{ type: "text", text: string }` is
// silently skipped — so tool calls or images would simply not show up in chat.
export function extractMessageText(parts: ChatMessage["parts"]): string {
	let text = "";
	for (const part of parts) {
		// Defensive shape check: only accept a real object whose `type` field
		// is exactly "text". The `as` casts are just to let us peek at fields
		// TypeScript doesn't know about; they don't change anything at runtime.
		if (
			part &&
			typeof part === "object" &&
			(part as { type?: unknown }).type === "text"
		) {
			// Even for a "text" part, only append `text` if it really is a
			// string — a malformed part contributes nothing rather than crashing.
			const value = (part as { text?: unknown }).text;
			if (typeof value === "string") text += value;
		}
	}
	return text;
}

/**
 * Draws a single chat message bubble.
 *
 * Props (all supplied by chat-pane.tsx):
 * - messageRole: "user" | "assistant" | "system" — decides which layout below.
 * - text: the already-flattened message text (chat-pane runs the parts through
 *   extractMessageText first, or passes the partial streaming text directly).
 * - isStreaming: true only for the one assistant message currently being
 *   generated; it adds a blinking caret at the end of the text.
 *
 * NOTE: only "user" gets its own branch. "system" messages (allowed by the
 * MessageRole contract) would fall through and render styled exactly like an
 * assistant message, complete with the "wandit" label. In practice the pane
 * never renders system messages today, but keep this in mind if that changes.
 */
export function RealChatMessage({
	messageRole,
	text,
	isStreaming = false,
}: {
	messageRole: MessageRole;
	text: string;
	isStreaming?: boolean;
}) {
	// A message with no text and no stream in progress has nothing to show
	// (e.g. a message whose parts were all tool calls) — render nothing at all.
	// While streaming we DO render even with empty text, so the caret appears
	// immediately and the user sees the reply "starting".
	if (!text && !isStreaming) return null;

	// USER MESSAGES: a right-aligned bubble, like most chat apps.
	// - dir="auto" lets the browser pick text direction per message, so Arabic
	//   input renders right-to-left while French/English stays left-to-right
	//   (important for the Algerian market's AR/FR mix).
	// - whitespace-pre-wrap preserves the user's line breaks; break-words stops
	//   a long URL from stretching the bubble past 85% width.
	// - rounded-ee-md flattens the bubble's end-end corner (bottom-right in
	//   LTR, bottom-left in RTL) for the classic "speech bubble tail" look.
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

	// ASSISTANT MESSAGES (and, by fallthrough, any non-user role): no bubble.
	// Instead: a small branded header row, then the reply as plain full-width
	// text — the common "AI answers in the open, user speaks in bubbles" style.
	return (
		<div className="flex flex-col gap-2.5">
			{/* Header row: the Spark logo mark plus a tiny uppercase "wandit"
			    label, marking this block as coming from the AI. */}
			<div className="flex items-center gap-1.5">
				<Spark className="size-3 text-primary" />
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
					wandit
				</span>
			</div>
			{/* The reply body. dir="auto" again handles Arabic RTL per message. */}
			<p
				dir="auto"
				className="whitespace-pre-wrap break-words text-foreground/90 text-sm leading-relaxed"
			>
				{text}
				{/* Blinking caret shown only while tokens are still arriving over
				    SSE. It's a 2px-wide pill that pulses via Tailwind's
				    animate-pulse. aria-hidden hides this purely decorative
				    element from screen readers. ms-0.5 is margin-inline-start,
				    the RTL-aware version of margin-left.
				    NOTE: cn() here wraps a single static string, so it adds
				    nothing — a plain className would behave identically. */}
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
