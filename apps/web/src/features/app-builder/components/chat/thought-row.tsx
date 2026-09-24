/**
 * One reasoning block of the agent in the activity feed: "Thinking" with a
 * running band while the block streams, then "Thought for {n}s". A click
 * opens the thinking text. Rendered by chat-message.tsx for each
 * `data-thought` part.
 */

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@wandit/ui/components/collapsible";
import { ChevronDown, Sparkles } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/lib/i18n";
import type { BuilderDataParts } from "../../api/dto";
import { ShimmerText } from "./shimmer-text";

/** Props of one `data-thought` part, as chat-message.tsx passes them. */
export type ThoughtRowProps = BuilderDataParts["thought"];

/** Shows "Thinking" while the block streams, then "Thought for {n}s"; a click opens the text. */
export function ThoughtRow({ text, seconds, isStreaming }: ThoughtRowProps) {
	const { t } = useTranslation();
	// null until the user clicks: the row then follows the stream, open while
	// the block streams and closed when it ends. A click wins after that.
	const [userOpen, setUserOpen] = useState<boolean | null>(null);
	const hasText = text.trim().length > 0;
	const isOpen = hasText && (userOpen ?? isStreaming);
	const label = isStreaming
		? t("appBuilder.chat.thinking")
		: seconds === null
			? t("appBuilder.chat.thought")
			: t("appBuilder.chat.thoughtFor", { seconds });

	return (
		<Collapsible open={isOpen} onOpenChange={setUserOpen} disabled={!hasText}>
			<CollapsibleTrigger className="group flex items-center gap-2 rounded-md py-1 text-muted-foreground text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:hover:text-muted-foreground">
				<Sparkles className="size-4 shrink-0" aria-hidden />
				{isStreaming ? <ShimmerText>{label}</ShimmerText> : label}
				{hasText ? (
					<ChevronDown
						className="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
						aria-hidden
					/>
				) : null}
			</CollapsibleTrigger>
			<CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none">
				<p
					dir="auto"
					className="ms-2 mt-1 mb-2 whitespace-pre-wrap break-words border-s ps-4 text-[13px] text-muted-foreground leading-relaxed"
				>
					{text}
				</p>
			</CollapsibleContent>
		</Collapsible>
	);
}
