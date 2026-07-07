/**
 * WHAT THIS FILE IS
 * -----------------
 * Two React components for the workspace chat column:
 *
 *   1. `ChatMessageView`   — renders one chat message from the OLD mock data
 *      shape (`ChatMessage` from `../../api/dto`, the placeholder types that
 *      predate the real backend contracts in `@wandit/contracts`).
 *   2. `ThinkingIndicator` — the little "wandit is typing…" bouncing-dots row.
 *
 * WHERE IT SITS IN THE CHAT FLOW
 * ------------------------------
 * The live chat pane (`chat-pane.tsx`) renders real messages with
 * `RealChatMessage` from `./real-message.tsx` (which deliberately copies this
 * file's styling), and only imports `ThinkingIndicator` from here. It shows
 * the indicator in the gap between "user pressed send" and "the first token
 * of the assistant reply arrives over the SSE stream" (SSE = Server-Sent
 * Events, a one-way HTTP connection the server pushes text chunks through).
 *
 * NOTE / GOTCHA: `ChatMessageView` currently has NO importers anywhere in the
 * app — it is dead legacy code from the mock-data era, kept around because
 * `GenerationCard` (the inline "version generated" artifact card) is wired up
 * here and not yet in the real renderer. When generation parts land in the
 * real contract shape, expect this component to either be revived or deleted.
 */

// Renders one chat message from its parts: user prompts as bubbles,
// assistant turns as marked text blocks with inline generation cards.

// `cn` is a tiny helper that merges Tailwind CSS class strings together
// (Tailwind = utility-class styling framework; every `className` below is
// a stack of small single-purpose classes instead of a CSS file).
import { cn } from "@wandit/ui/lib/utils";

// Spark is the small Wandit logo glyph used as the assistant's "avatar".
import { Spark } from "@/components/logo";
// IMPORTANT: this is the MOCK message type (id/role/parts/createdAt with
// text + generation parts), not the real one from @wandit/contracts.
import type { ChatMessage } from "../../api/dto";
import { GenerationCard } from "./generation-card";

/**
 * Renders a single chat message (LEGACY — see file header; nothing imports
 * this today). A message is a list of "parts" rather than one string, in the
 * AI SDK style: text parts are prose, generation parts are inline cards for
 * a page version the AI produced. `isStreaming` makes the last text part show
 * a blinking caret so it reads as "still being typed".
 */
export function ChatMessageView({
	message,
	isStreaming = false,
}: {
	message: ChatMessage;
	isStreaming?: boolean;
}) {
	// --- USER MESSAGES: a right-aligned speech bubble -----------------------
	if (message.role === "user") {
		// Flatten all text parts into one string; non-text parts (e.g. a
		// generation card) can't appear in a user message, so they map to "".
		const textContent = message.parts
			.map((part) => (part.type === "text" ? part.text : ""))
			.join("");
		return (
			// `justify-end` pushes the bubble to the trailing edge (right in
			// LTR, left in RTL) — the classic "my messages on my side" layout.
			<div className="flex justify-end">
				{/* dir="auto" lets the browser detect Arabic vs Latin text and set
				    the writing direction per message — important for the Algerian
				    market where users mix Arabic and French freely. */}
				<div
					dir="auto"
					className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-ee-md border border-border bg-secondary px-3.5 py-2.5 text-sm leading-relaxed"
				>
					{textContent}
				</div>
			</div>
		);
	}

	// --- ASSISTANT MESSAGES: full-width, with a "wandit" byline -------------
	return (
		<div className="flex flex-col gap-2.5">
			{/* Byline: the Spark logo + the product name, styled like a tiny
			    monospace label. This is the assistant's "avatar" row. */}
			<div className="flex items-center gap-1.5">
				<Spark className="size-3 text-primary" />
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
					wandit
				</span>
			</div>
			{/* Walk the parts in order: text parts render as paragraphs,
			    everything else (only "generation" today) renders as a card. */}
			{message.parts.map((part, index) => {
				if (part.type === "text") {
					// Skip empty text parts entirely instead of rendering an
					// empty <p> that would still take up vertical gap space.
					if (!part.text) return null;
					// The blinking caret should only ever sit at the very end
					// of the message, so track whether this is the final part.
					const isLastPart = index === message.parts.length - 1;
					return (
						<p
							// biome-ignore lint/suspicious/noArrayIndexKey: parts are positional
							key={index}
							dir="auto"
							className="whitespace-pre-wrap break-words text-foreground/90 text-sm leading-relaxed"
						>
							{part.text}
							{/* The "typing caret": a thin pulsing bar appended to the
							    last paragraph while the reply is still streaming in.
							    aria-hidden keeps screen readers from announcing it. */}
							{isStreaming && isLastPart ? (
								<span
									aria-hidden
									className={cn(
										"ms-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse rounded-full bg-primary",
									)}
								/>
							) : null}
						</p>
					);
				}
				// Any non-text part is a generation part: render the inline
				// artifact card (shimmer while running, clickable when done —
				// clicking selects that page version in the canvas).
				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: parts are positional
					<GenerationCard key={index} part={part} />
				);
			})}
		</div>
	);
}

// THIS ONE IS STILL LIVE: chat-pane.tsx renders it (with a translated
// "thinking…" label) right after the user sends a message, and swaps it out
// as soon as the first streamed token of the assistant reply arrives.
// Same byline layout as an assistant message so the swap doesn't jump.
/** Ember thinking indicator shown before the assistant reply streams. */
export function ThinkingIndicator({ label }: { label: string }) {
	return (
		<div className="flex flex-col gap-2.5">
			<div className="flex items-center gap-2">
				<span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-gradient-ember">
					<Spark className="size-3 animate-pulse text-background" />
				</span>
				<span className="font-medium text-foreground text-sm">Wandit</span>
			</div>
			{/* Three tiny dots bouncing in a wave: all three run the same bounce
			    animation, but the negative animation-delays start the first two
			    "earlier" in the cycle, staggering them into a ripple. */}
			<div className="flex items-center gap-1.5 text-muted-foreground text-sm">
				<span className="flex items-center gap-1">
					<span className="size-1 animate-bounce rounded-full bg-primary/70 [animation-delay:-0.3s]" />
					<span className="size-1 animate-bounce rounded-full bg-primary/70 [animation-delay:-0.15s]" />
					<span className="size-1 animate-bounce rounded-full bg-primary/70" />
				</span>
				{label}
			</div>
		</div>
	);
}
