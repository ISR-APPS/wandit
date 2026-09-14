/**
 * The chat card of the app builder. The header shows the project name, the
 * pulsing turn dot, and the collapse button. Below it sit the scrolling
 * message list and the composer pinned at the bottom.
 * Rendered by pages/app-builder-page.tsx, which owns the thread data, the
 * send mutation, and the card chrome. Renders chat-message.tsx and
 * composer.tsx.
 */

import { Button } from "@wandit/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";
import { PanelLeftClose } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import type { SendBuilderMessageInput } from "../../api/app-builder.services";
import type { BuilderMessage } from "../../api/dto";
import { ChatMessageView } from "./chat-message";
import { Composer } from "./composer";

export type ChatPaneProps = {
	/** Messages of the thread, oldest first. */
	messages: BuilderMessage[];
	/** Credits one turn costs, whole credits. Shown next to the send button. */
	turnEstimateCredits: number;
	/** Screen or element the next turn targets, shown as a chip above the textarea. */
	focusLabel: string | null;
	/** True while a turn runs. Locks the composer and shows the working indicator. */
	isSending: boolean;
	/** Name of the open project. Shown after "Chat" in the card header. */
	projectName: string;
	onSend: (input: SendBuilderMessageInput) => void;
	/** Hides the chat. The header button calls it; the page stores the choice. */
	onCollapse: () => void;
	/** Opens the preview on a saved version. The change card calls it. */
	onPreviewVersion: (versionNumber: number) => void;
	className?: string;
};

export function ChatPane({
	messages,
	turnEstimateCredits,
	focusLabel,
	isSending,
	projectName,
	onSend,
	onCollapse,
	onPreviewVersion,
	className,
}: ChatPaneProps) {
	const { t } = useTranslation();
	const listRef = useRef<HTMLDivElement>(null);

	// A new message or the working row appears below the visible area. Keep the end in view.
	// biome-ignore lint/correctness/useExhaustiveDependencies: both deps are the re-scroll triggers
	useEffect(() => {
		const list = listRef.current;
		if (list) list.scrollTop = list.scrollHeight;
	}, [messages.length, isSending]);

	return (
		<div className={cn("flex min-h-0 flex-col overflow-hidden", className)}>
			<div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
				<span className="font-medium text-[15px]">
					{t("appBuilder.chat.title")}
				</span>
				<span className="min-w-0 truncate text-[13px] text-muted-foreground">
					· {projectName}
				</span>
				<span className="ms-auto flex items-center gap-0.5">
					{isSending ? (
						// Decorative only: the working row in the list already carries role="status".
						<span
							aria-hidden
							className="me-1.5 size-[7px] animate-pulse-soft rounded-full bg-primary"
						/>
					) : null}
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label={t("appBuilder.topBar.collapseChat")}
								onClick={onCollapse}
							>
								{/* In RTL the chat sits on the right, so the icon mirrors. */}
								<PanelLeftClose className="size-4 rtl:-scale-x-100" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom">
							{t("appBuilder.topBar.collapseChat")}
						</TooltipContent>
					</Tooltip>
				</span>
			</div>
			<div
				ref={listRef}
				className="scroll-warm flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-4 pb-3"
			>
				{messages.map((message) => (
					<ChatMessageView
						key={message.id}
						message={message}
						onPreviewVersion={onPreviewVersion}
						// A follow-up, an answer, or an accepted suggestion is a normal build turn.
						// The cards stay clickable while a turn runs, so the pane drops a second send.
						onSendText={(text) => {
							if (!isSending) onSend({ text, mode: "build" });
						}}
					/>
				))}
				{isSending ? (
					<WorkingIndicator label={t("appBuilder.chat.working")} />
				) : null}
			</div>
			<div className="shrink-0 px-4 pt-2 pb-4">
				<Composer
					turnEstimateCredits={turnEstimateCredits}
					focusLabel={focusLabel}
					isSending={isSending}
					onSend={onSend}
				/>
			</div>
		</div>
	);
}

// A 3 by 3 grid. Each pixel starts later along the diagonal, so the shimmer runs corner to corner.
const PIXEL_GRID = [0, 1, 2].flatMap((row) =>
	[0, 1, 2].map((column) => ({
		key: `${row}${column}`,
		delayMs: (row + column) * 120,
	})),
);

/** Shimmering pixel grid, the working label, and the seconds since the row appeared. */
function WorkingIndicator({ label }: { label: string }) {
	const { t, locale } = useTranslation();
	const [startedAt] = useState(() => Date.now());
	const [elapsedMs, setElapsedMs] = useState(0);

	// One tick per 100 ms reads the clock, so a slow tab does not drift the counter.
	useEffect(() => {
		const timer = setInterval(() => setElapsedMs(Date.now() - startedAt), 100);
		return () => clearInterval(timer);
	}, [startedAt]);

	const seconds = new Intl.NumberFormat(locale, {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	}).format(elapsedMs / 1000);

	return (
		<div
			role="status"
			className="flex items-center gap-2.5 text-muted-foreground text-sm"
		>
			<span aria-hidden className="grid size-3.5 shrink-0 grid-cols-3 gap-px">
				{PIXEL_GRID.map((pixel) => (
					<span
						key={pixel.key}
						className="animate-pulse-soft rounded-[1px] bg-primary"
						style={{ animationDelay: `${pixel.delayMs}ms` }}
					/>
				))}
			</span>
			<span>{label}</span>
			<span className="font-mono text-xs tabular-nums">
				{t("appBuilder.chat.elapsed", { seconds })}
			</span>
		</div>
	);
}
