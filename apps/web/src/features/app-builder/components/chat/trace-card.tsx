/**
 * Thinking trace of one assistant message: a "Thought for {n}s" toggle and
 * the list of steps the agent did before it answered.
 * Rendered by chat-message.tsx for each `data-trace` part.
 * Not a card: no border, no MessageCard. Only the open state lives here.
 */

import { cn } from "@wandit/ui/lib/utils";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/lib/i18n";
import type { BuilderTraceStep } from "../../api/dto";

/** Props of one `data-trace` part, as chat-message.tsx passes them. */
export type TraceCardProps = {
	/** Whole seconds the agent thought before it answered. Shown in the toggle label. */
	seconds: number;
	/** Steps in the order the agent did them. Each shows its label and optional detail. */
	steps: BuilderTraceStep[];
};

/** Muted toggle that opens the trace. Open by default; a click hides or shows the steps. */
export function TraceCard({ seconds, steps }: TraceCardProps) {
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
				<Sparkles className="size-3.5 text-primary" aria-hidden />
				{t("appBuilder.chat.thoughtFor", { seconds })}
				<ChevronDown
					className={cn(
						"size-3.5 text-muted-foreground transition-transform",
						open && "rotate-180",
					)}
					aria-hidden
				/>
			</button>
			{open ? (
				<ul className="ms-[7px] mt-2 flex flex-col gap-2 border-s ps-4">
					{steps.map((step, index) => {
						// Trace steps carry no id and never reorder. The index is stable inside one part.
						const key = `${index}-${step.label}`;
						return (
							<li key={key} className="flex items-center gap-2 text-sm">
								<Check
									className="size-3.5 shrink-0 text-muted-foreground"
									aria-hidden
								/>
								<span dir="auto">{step.label}</span>
								{step.detail !== null ? (
									<span dir="auto" className="text-muted-foreground text-xs">
										{step.detail}
									</span>
								) : null}
							</li>
						);
					})}
				</ul>
			) : null}
		</div>
	);
}
