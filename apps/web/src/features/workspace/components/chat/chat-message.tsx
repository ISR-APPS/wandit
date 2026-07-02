// Renders one chat message from its parts: user prompts as bubbles,
// assistant turns as marked text blocks with inline generation cards.

import { cn } from "@my-better-t-app/ui/lib/utils";

import { Spark } from "@/components/logo";
import type { ChatMessage } from "../../api/dto";
import { GenerationCard } from "./generation-card";

export function ChatMessageView({
	message,
	isStreaming = false,
}: {
	message: ChatMessage;
	isStreaming?: boolean;
}) {
	if (message.role === "user") {
		const textContent = message.parts
			.map((part) => (part.type === "text" ? part.text : ""))
			.join("");
		return (
			<div className="flex justify-end">
				<div
					dir="auto"
					className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md border border-border/60 bg-secondary px-3.5 py-2.5 text-sm leading-relaxed"
				>
					{textContent}
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
			{message.parts.map((part, index) => {
				if (part.type === "text") {
					if (!part.text) return null;
					const isLastPart = index === message.parts.length - 1;
					return (
						<p
							// biome-ignore lint/suspicious/noArrayIndexKey: parts are positional
							key={index}
							dir="auto"
							className="whitespace-pre-wrap text-foreground/90 text-sm leading-relaxed"
						>
							{part.text}
							{isStreaming && isLastPart ? (
								<span
									aria-hidden
									className={cn(
										"ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse rounded-full bg-primary",
									)}
								/>
							) : null}
						</p>
					);
				}
				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: parts are positional
					<GenerationCard key={index} part={part} />
				);
			})}
		</div>
	);
}

/** Ember thinking indicator shown before the assistant reply streams. */
export function ThinkingIndicator({ label }: { label: string }) {
	return (
		<div className="flex flex-col gap-2.5">
			<div className="flex items-center gap-1.5">
				<Spark className="size-3 animate-pulse text-primary" />
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
					wandit
				</span>
			</div>
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
