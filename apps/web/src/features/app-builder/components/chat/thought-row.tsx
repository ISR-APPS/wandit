/**
 * One reasoning block of the agent in the activity feed: "Thinking" with a
 * running band while the block streams, then "Thought for {n}s". A click
 * opens the thinking text. Rendered by chat-message.tsx for each
 * `data-thought` part.
 */

import { CaretDownIcon } from "@phosphor-icons/react/CaretDown";
import { SparkleIcon } from "@phosphor-icons/react/Sparkle";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@wandit/ui/components/collapsible";
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
			<CollapsibleTrigger className="group flex min-h-7 items-center gap-2 rounded-[8px] py-0.5 font-grotesk text-[13px] text-night/70 outline-none transition-colors duration-150 hover:text-night focus-visible:ring-2 focus-visible:ring-ember/30 disabled:hover:text-night/70 dark:text-foreground/70 dark:hover:text-foreground dark:disabled:hover:text-foreground/70">
				<span className="grid size-4 shrink-0 place-items-center">
					<SparkleIcon
						weight="duotone"
						className="size-4 text-spark-deep dark:text-spark"
						aria-hidden
					/>
				</span>
				{isStreaming ? <ShimmerText>{label}</ShimmerText> : label}
				{hasText ? (
					<CaretDownIcon
						weight="bold"
						className="size-3 shrink-0 text-night/35 transition-transform group-hover:text-night/70 group-data-[state=open]:rotate-180 motion-reduce:transition-none dark:text-foreground/35 dark:group-hover:text-foreground/70"
						aria-hidden
					/>
				) : null}
			</CollapsibleTrigger>
			<CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none">
				<p
					dir="auto"
					className="ms-2 mt-1 mb-2 whitespace-pre-wrap break-words border-night/[0.1] border-s-2 ps-3.5 font-sans text-[13px] text-night/60 leading-relaxed dark:border-white/[0.1] dark:text-foreground/60"
				>
					{text}
				</p>
			</CollapsibleContent>
		</Collapsible>
	);
}
