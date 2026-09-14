/**
 * Tool calls and changed files of one builder turn, under a "{n} tool calls"
 * toggle. Not a card: the block sits flat in the thread.
 * Rendered by chat-message.tsx for each `data-tools` part.
 * Pure presentation: the part data decides every row and chip.
 */

import { cn } from "@wandit/ui/lib/utils";
import {
	ChevronDown,
	FileText,
	type LucideIcon,
	PencilLine,
	Sparkles,
	Terminal,
} from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/lib/i18n";
import type { BuilderFileChange, BuilderToolCall } from "../../api/dto";

/** Props of one `data-tools` part, as chat-message.tsx passes them. */
export type ToolChipsProps = {
	/** Tool calls of the turn, in the order the agent made them. */
	calls: BuilderToolCall[];
	/** Files the turn changed, with their added and removed line counts. */
	files: BuilderFileChange[];
};

/** Row icon of each call kind: a spark, a pen, a terminal, or a file. */
const ICONS: Record<BuilderToolCall["kind"], LucideIcon> = {
	think: Sparkles,
	write: PencilLine,
	run: Terminal,
	read: FileText,
};

/** "{n} tool calls" toggle with the call rows and the file chips under it. Open by default. */
export function ToolChips({ calls, files }: ToolChipsProps) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(true);

	return (
		<div className="flex flex-col">
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen((value) => !value)}
				className="flex items-center gap-1.5 self-start rounded-sm text-muted-foreground text-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
			>
				<ChevronDown
					className={cn("size-3.5 transition-transform", open && "rotate-180")}
					aria-hidden
				/>
				{t("appBuilder.chat.toolCalls", { count: calls.length })}
			</button>
			{open ? (
				<>
					<ul className="mt-2 flex flex-col gap-1.5">
						{calls.map((call, index) => {
							// A call has no id and the list never reorders, so the position is the key.
							const key = `${index}-${call.target}`;
							const Icon = ICONS[call.kind];
							return (
								<li
									key={key}
									data-tool-kind={call.kind}
									className="flex min-w-0 items-center gap-2 text-sm"
								>
									<Icon
										className="size-3.5 shrink-0 text-muted-foreground"
										aria-hidden
									/>
									<span dir="auto" className="shrink-0">
										{call.label}
									</span>
									<span
										dir="ltr"
										className="min-w-0 truncate rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[12px]"
									>
										{call.target}
									</span>
								</li>
							);
						})}
					</ul>
					{files.length > 0 ? (
						<ul className="mt-2.5 flex flex-wrap gap-1.5">
							{files.map((file) => (
								<li
									key={file.path}
									dir="ltr"
									className="flex items-center gap-1.5 rounded-md border bg-muted px-2 py-1 font-mono text-[12px]"
								>
									{file.path}
									{file.added > 0 ? (
										<span className="text-success-text">+{file.added}</span>
									) : null}
									{file.removed > 0 ? (
										<span className="text-destructive">-{file.removed}</span>
									) : null}
								</li>
							))}
						</ul>
					) : null}
				</>
			) : null}
		</div>
	);
}
