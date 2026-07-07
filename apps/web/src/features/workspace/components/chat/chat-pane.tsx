// Collapsible chat pane: real message history, live SSE streaming reply and the
// compact ember PromptBox. Sizing/positioning (resizable panel on desktop,
// full-screen overlay on mobile) is owned by the parent layout — this
// component only fills its container (desktop passes card chrome via
// className) and self-inerts when collapsed.
//
// ── Where this fits in the end-to-end chat flow ──────────────────────────────
// 1. `pages/workspace-page.tsx` renders <ChatPane /> — on desktop inside a
//    resizable side panel (min 440px, collapsible to 0px width), on mobile as
//    a full-screen overlay that the parent hides when chat is closed.
// 2. This component is deliberately "dumb" presentation: ALL data + networking
//    live in the `useProjectChat` hook (../../lib/use-project-chat.tsx). That
//    hook resolves the chat id, loads history, keeps ONE SSE stream open to
//    the NestJS API, and hands us `send()` plus live streaming state.
// 3. When the user submits text (the PromptBox at the bottom, or an
//    empty-state suggestion chip), `send()` POSTs the message; the API
//    enqueues a background job; the worker calls the AI model and streams
//    tokens back through Redis → SSE → the hook → the `streamingMessage`
//    value rendered here as a live-growing assistant bubble.
// GOTCHA: on desktop the pane is never unmounted when "closed" — the panel
// just shrinks to zero width. That's why the <aside> below sets `inert`:
// otherwise its hidden-but-still-mounted buttons would stay keyboard-tabbable.

// Shared design-system pieces (the Radix/shadcn-based @wandit/ui kit).
import { Button } from "@wandit/ui/components/button";
import { Skeleton } from "@wandit/ui/components/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
// `cn` is a tiny helper that merges Tailwind class strings (and resolves
// conflicts between them) — you'll see it everywhere in this codebase.
import { cn } from "@wandit/ui/lib/utils";
import { MessagesSquare, PanelLeftClose } from "lucide-react";
import { useEffect, useRef } from "react";

// Spark = the little Wandit brand mark used as the assistant avatar.
import { Spark } from "@/components/logo";
// PromptBox is THE shared signature composer (ember-styled input with engine
// picker, mic, etc.), reused from the projects feature in its compact variant.
import { PromptBox } from "@/features/projects";
import { useDictionary, useTranslation } from "@/lib/i18n";
// useWorkspace = React Context (despite the "store" filename, it's plain
// context, not Zustand) holding workspace-wide UI state like chatOpen.
import { useWorkspace } from "../../lib/store";
// The brain of this pane: queries + SSE stream + send(), documented above.
import { useProjectChat } from "../../lib/use-project-chat";
import { ThinkingIndicator } from "./chat-message";
// RealChatMessage renders one persisted/streaming bubble; extractMessageText
// flattens a message's `parts` array down to its plain text content.
import { extractMessageText, RealChatMessage } from "./real-message";

// The chat pane surface itself. Mounted by workspace-page.tsx; the optional
// `className` lets the desktop layout pass card chrome (rounded border +
// shadow) while mobile renders it flush and full-bleed.
export function ChatPane({ className }: { className?: string }) {
	// i18n hooks: `t(key)` returns one translated string, `dir` is "ltr"/"rtl"
	// (Arabic flips the layout), and `dictionary` exposes the raw translation
	// object — needed below because the suggestion chips are an ARRAY of
	// strings, which `t` (single string in, single string out) can't return.
	const { t, dir } = useTranslation();
	const dictionary = useDictionary();
	const { chatOpen, toggleChat, project, projectId } = useWorkspace();
	// Everything data-related comes from useProjectChat. Under the hood it uses
	// TanStack Query (a data-fetching library that caches server responses and
	// lets you patch/invalidate that cache) plus an SSE subscription — SSE
	// (Server-Sent Events) is a long-lived one-way HTTP connection the browser
	// keeps open so the server can push events as the AI generates.
	// What we pull out:
	//  - messages:          persisted history, already sorted by sequence
	//  - streamingMessage:  the in-flight assistant bubble { messageId, text },
	//                       grown token-by-token from SSE "delta" events
	//  - phase:             "idle" | "thinking" | "streaming" (drives a11y text)
	//  - generationActive:  a job is running server-side for this chat
	//  - isGenerating:      generationActive OR the send POST is still in flight
	//  - isResolvingChat/isLoadingMessages: first-load flags (skeleton state)
	//  - send(text, composer?): optimistically appends the user bubble, then
	//                       POSTs to the API (which enqueues the worker job)
	const {
		messages,
		streamingMessage,
		phase,
		generationActive,
		isGenerating,
		isResolvingChat,
		isLoadingMessages,
		send,
	} = useProjectChat(projectId);

	// useRef gives us a stable handle to the scrollable <div> DOM node so the
	// effect below can set scrollTop directly, without triggering re-renders.
	const scrollRef = useRef<HTMLDivElement>(null);
	// Still resolving the chat id or fetching the first page of history —
	// while this is true we show skeleton placeholders instead of messages.
	const pending = isResolvingChat || isLoadingMessages;

	// Keep the newest message in view while history grows or text streams in.
	// The deps aren't read inside the effect — they're listed purely as "re-run
	// whenever content grows" triggers, hence the biome-ignore (the linter
	// would otherwise complain the dependency list doesn't match usage).
	// NOTE: this always force-scrolls to the bottom. If the user scrolls up to
	// re-read older messages mid-stream, every new token yanks them back down.
	// A "only stick when already near the bottom" check would be the fix.
	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll reacts to content growth
	useEffect(() => {
		const el = scrollRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [messages.length, streamingMessage, pending]);

	// Derived display flags:
	//  - isEmpty: show the empty-state hero only when there is truly nothing —
	//    no history, no live bubble, no running job, and loading is finished.
	//  - showThinking: animated "thinking" dots while a job runs but no tokens
	//    have arrived yet; once deltas flow, the streaming bubble replaces it.
	const isEmpty =
		!pending && messages.length === 0 && !streamingMessage && !generationActive;
	const showThinking = generationActive && !streamingMessage;

	return (
		<aside
			// inert removes the collapsed pane's controls from tab order and AT —
			// the resizable panel shrinks it to zero width rather than unmounting it.
			// ("AT" = assistive technology, e.g. screen readers. `inert` is a native
			// HTML attribute that makes an element and everything inside it
			// non-interactive and invisible to those tools.)
			inert={!chatOpen}
			className={cn(
				"relative z-30 flex h-full min-h-0 w-full flex-col overflow-hidden bg-card",
				className,
			)}
		>
			<div className="flex h-full w-full flex-col">
				{/* Screenreader announcement for the otherwise-visual job states. */}
				{/* aria-live="polite" tells screen readers to read out changes to this
				    text when idle; sr-only hides it visually but keeps it in the
				    accessibility tree. */}
				<span aria-live="polite" className="sr-only">
					{phase === "thinking" || phase === "streaming"
						? t("workspace.chat.thinking")
						: ""}
				</span>
				{/* Header bar: pane title, a small project-name chip, and the collapse
				    button (which flips `chatOpen` in the workspace context — the parent
				    layout reacts by collapsing the panel / hiding the overlay). */}
				<div className="flex h-12 shrink-0 items-center justify-between border-b px-3">
					<span className="flex min-w-0 items-center gap-2 font-medium text-sm">
						<MessagesSquare className="size-4 shrink-0 text-muted-foreground" />
						{t("workspace.chat.title")}
						{project?.name ? (
							<span
								dir="auto"
								className="min-w-0 truncate rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
							>
								{project.name}
							</span>
						) : null}
					</span>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={toggleChat}
								aria-label={t("workspace.chat.collapse")}
							>
								<PanelLeftClose className="size-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side={dir === "rtl" ? "left" : "right"}>
							{t("workspace.chat.collapse")}
						</TooltipContent>
					</Tooltip>
				</div>

				<div
					ref={scrollRef}
					className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 py-4"
				>
					{pending ? (
						<div className="flex flex-col gap-4">
							<Skeleton className="ms-auto h-14 w-3/4 rounded-2xl" />
							<Skeleton className="h-20 w-5/6 rounded-xl" />
							<Skeleton className="ms-auto h-10 w-2/3 rounded-2xl" />
						</div>
					) : isEmpty ? (
						<div className="flex h-full flex-col items-center justify-center gap-2 text-center">
							<Spark className="size-5 text-primary/60" />
							<p className="font-display font-semibold text-sm">
								{t("workspace.chat.emptyTitle")}
							</p>
							<p className="max-w-56 text-muted-foreground text-xs leading-relaxed">
								{t("workspace.chat.emptyBody")}
							</p>
							<p className="mt-4 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-widest">
								{t("workspace.chat.suggestionsKicker")}
							</p>
							<div className="flex flex-col items-center gap-1.5">
								{dictionary.workspace.chat.suggestions.map((suggestion) => (
									<Button
										key={suggestion}
										type="button"
										variant="outline"
										size="sm"
										className="h-7 rounded-full bg-card px-3 font-normal text-muted-foreground text-xs shadow-none hover:text-foreground"
										onClick={() => send(suggestion)}
									>
										{suggestion}
									</Button>
								))}
							</div>
						</div>
					) : (
						<div className="flex flex-col gap-5">
							{messages.map((message) => (
								<RealChatMessage
									key={message.id}
									messageRole={message.role}
									text={extractMessageText(message.parts)}
								/>
							))}
							{streamingMessage ? (
								<RealChatMessage
									messageRole="assistant"
									text={streamingMessage.text}
									isStreaming
								/>
							) : null}
							{showThinking ? (
								<ThinkingIndicator label={t("workspace.chat.thinking")} />
							) : null}
						</div>
					)}
				</div>

				<div className="shrink-0 px-3 pt-1 pb-3">
					<PromptBox
						variant="compact"
						showEngines
						showPriceTag
						clearOnSubmit
						placeholder={t("workspace.chat.placeholder")}
						onSubmit={(text, composer) => send(text, composer)}
						isSubmitting={isGenerating}
					/>
				</div>
			</div>
		</aside>
	);
}
