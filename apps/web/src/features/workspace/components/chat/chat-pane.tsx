// Collapsible chat pane: message history, streaming assistant reply and the
// compact ember PromptBox. Sizing/positioning (resizable panel on desktop,
// full-screen overlay on mobile) is owned by the parent layout — this
// component only fills its container (desktop passes card chrome via
// className) and self-inerts when collapsed.

import { Button } from "@wandit/ui/components/button";
import { Skeleton } from "@wandit/ui/components/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";
import { MessagesSquare, PanelLeftClose } from "lucide-react";
import { useEffect, useRef } from "react";

import { Spark } from "@/components/logo";
import { InsufficientCreditsDialog } from "@/features/credits";
import { PromptBox } from "@/features/projects";
import { useTranslation } from "@/lib/i18n";
import { useWorkspace } from "../../lib/store";
import { ChatMessageView, ThinkingIndicator } from "./chat-message";

export function ChatPane({ className }: { className?: string }) {
	const { t, dir } = useTranslation();
	const {
		chatOpen,
		toggleChat,
		state,
		statePending,
		streamingMessage,
		generationPhase,
		isGenerating,
		pendingVersionNumber,
		sendPrompt,
		generationCost,
		insufficientOpen,
		setInsufficientOpen,
		project,
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
			// inert removes the collapsed pane's controls from tab order and AT —
			// the resizable panel shrinks it to zero width rather than unmounting it.
			inert={!chatOpen}
			className={cn(
				"relative z-30 flex h-full min-h-0 w-full flex-col overflow-hidden bg-card",
				className,
			)}
		>
			<div className="flex h-full w-full flex-col">
				{/* Screenreader announcement for the otherwise-visual job states. */}
				<span aria-live="polite" className="sr-only">
					{generationPhase === "thinking" || generationPhase === "streaming"
						? t("workspace.chat.thinking")
						: generationPhase === "building"
							? t("workspace.page.generatingTitle", {
									n: pendingVersionNumber,
								})
							: ""}
				</span>
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
					{statePending ? (
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
						</div>
					) : (
						<div className="flex flex-col gap-5">
							{messages.map((message) => (
								<ChatMessageView key={message.id} message={message} />
							))}
							{generationPhase === "thinking" ? (
								<ThinkingIndicator label={t("workspace.chat.thinking")} />
							) : streamingMessage ? (
								<ChatMessageView
									message={streamingMessage}
									isStreaming={generationPhase === "streaming"}
								/>
							) : null}
						</div>
					)}
				</div>

				<div className="shrink-0 border-t p-3">
					<PromptBox
						variant="compact"
						showPriceTag
						clearOnSubmit
						placeholder={t("workspace.chat.placeholder")}
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
