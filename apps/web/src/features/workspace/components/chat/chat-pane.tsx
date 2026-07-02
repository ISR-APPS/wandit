// Collapsible chat pane: message history, streaming assistant reply and the
// compact ember PromptBox. Collapses to zero width on desktop; overlays the
// canvas on mobile.

import { Button } from "@my-better-t-app/ui/components/button";
import { Skeleton } from "@my-better-t-app/ui/components/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@my-better-t-app/ui/components/tooltip";
import { cn } from "@my-better-t-app/ui/lib/utils";
import { MessagesSquare, PanelLeftClose } from "lucide-react";
import { useEffect, useRef } from "react";

import { Spark } from "@/components/logo";
import { InsufficientCreditsDialog } from "@/features/credits";
import { PromptBox } from "@/features/projects";
import { WORKSPACE_COPY } from "../../lib/constants";
import { useWorkspace } from "../../lib/store";
import { ChatMessageView, ThinkingIndicator } from "./chat-message";

const COPY = WORKSPACE_COPY.chat;

export function ChatPane() {
	const {
		chatOpen,
		toggleChat,
		state,
		statePending,
		streamingMessage,
		generationPhase,
		isGenerating,
		sendPrompt,
		generationCost,
		insufficientOpen,
		setInsufficientOpen,
	} = useWorkspace();

	const scrollRef = useRef<HTMLDivElement>(null);
	const messages = state?.messages ?? [];

	// Keep the newest message in view while history grows or text streams in.
	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll reacts to content growth
	useEffect(() => {
		const el = scrollRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [messages.length, streamingMessage, statePending]);

	const isEmpty = !statePending && messages.length === 0 && !streamingMessage;

	return (
		<aside
			className={cn(
				"relative z-30 h-full min-h-0 shrink-0 overflow-hidden border-r bg-sidebar transition-[width] duration-300 ease-in-out",
				"max-md:absolute max-md:inset-0 max-md:z-30 max-md:w-full max-md:border-r-0",
				chatOpen ? "md:w-[380px]" : "max-md:hidden md:w-0 md:border-r-0",
			)}
		>
			<div className="flex h-full w-full flex-col md:w-[380px]">
				<div className="flex h-11 shrink-0 items-center justify-between border-b px-3">
					<span className="flex items-center gap-2 font-medium text-sm">
						<MessagesSquare className="size-4 text-muted-foreground" />
						{COPY.title}
					</span>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={toggleChat}
								aria-label={COPY.collapse}
							>
								<PanelLeftClose className="size-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="right">{COPY.collapse}</TooltipContent>
					</Tooltip>
				</div>

				<div
					ref={scrollRef}
					className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 py-4"
				>
					{statePending ? (
						<div className="flex flex-col gap-4">
							<Skeleton className="ml-auto h-14 w-3/4 rounded-2xl" />
							<Skeleton className="h-20 w-5/6 rounded-xl" />
							<Skeleton className="ml-auto h-10 w-2/3 rounded-2xl" />
						</div>
					) : isEmpty ? (
						<div className="flex h-full flex-col items-center justify-center gap-2 text-center">
							<Spark className="size-5 text-primary/60" />
							<p className="font-display font-semibold text-sm">
								{COPY.emptyTitle}
							</p>
							<p className="max-w-56 text-muted-foreground text-xs leading-relaxed">
								{COPY.emptyBody}
							</p>
						</div>
					) : (
						<div className="flex flex-col gap-5">
							{messages.map((message) => (
								<ChatMessageView key={message.id} message={message} />
							))}
							{generationPhase === "thinking" ? (
								<ThinkingIndicator label={COPY.thinking} />
							) : streamingMessage ? (
								<ChatMessageView
									message={streamingMessage}
									isStreaming={generationPhase === "streaming"}
								/>
							) : null}
						</div>
					)}
				</div>

				<div className="shrink-0 border-t bg-sidebar p-3">
					<PromptBox
						variant="compact"
						showPriceTag
						clearOnSubmit
						placeholder={COPY.placeholder}
						onSubmit={sendPrompt}
						isSubmitting={isGenerating}
					/>
					<InsufficientCreditsDialog
						open={insufficientOpen}
						onOpenChange={setInsufficientOpen}
						cost={generationCost}
					/>
				</div>
			</div>
		</aside>
	);
}
