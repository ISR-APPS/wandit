/**
 * The context ring of the builder composer: a round gauge that shows how
 * full the model context is. A click opens a popover with the token count
 * and a note on the automatic compaction. Near the limit, the popover also
 * offers a new conversation. Rendered by composer.tsx. The values come from
 * `contextUsageOf` in lib/turn-parts.ts.
 */

import { Button } from "@wandit/ui/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@wandit/ui/components/popover";
import { cn } from "@wandit/ui/lib/utils";

import { formatNumber, useTranslation } from "@/lib/i18n";
import {
	type ContextTone,
	type ContextUsage,
	contextToneOf,
} from "../../lib/turn-parts";

// Text color of the arc for each tone; the arc draws with `stroke-current`.
const ARC_CLASS: Record<ContextTone, string> = {
	neutral: "text-night/55 dark:text-foreground/55",
	warning: "text-spark-deep dark:text-spark",
	full: "text-destructive",
};

/**
 * A ghost icon button with a 20 px ring, the size of the dictation button.
 * It stays enabled while a turn runs: it only opens the popover.
 */
export function ContextRing({
	usage,
	onCreateChat,
}: {
	/** The count of the newest turn, from useBuilderThread through the chat pane. */
	usage: ContextUsage;
	/** Creates an empty conversation and opens it, from the page. Absent for a project viewer: the popover then has no button. */
	onCreateChat?: () => void;
}) {
	const { t, locale } = useTranslation();
	const tone = contextToneOf(usage);
	const title = t("appBuilder.chat.context.title", {
		percent: formatNumber(usage.percent, locale),
	});
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label={title}
					className="rounded-full hover:bg-night/[0.06] dark:hover:bg-white/[0.08]"
				>
					<svg
						viewBox="0 0 20 20"
						fill="none"
						className="size-5"
						aria-hidden
						role="presentation"
					>
						<circle
							cx="10"
							cy="10"
							r="8"
							strokeWidth="2.5"
							className="stroke-current text-night/[0.12] dark:text-white/[0.14]"
						/>
						{/* A circle path starts at 3 o'clock. The turn moves the start to 12 o'clock.
						The arc grows clockwise in LTR and in RTL, so it needs no mirror. */}
						<circle
							cx="10"
							cy="10"
							r="8"
							strokeWidth="2.5"
							// The path length is 100 units, so the dash length is the percent.
							pathLength={100}
							strokeDasharray={`${usage.percent} 100`}
							transform="rotate(-90 10 10)"
							className={cn("stroke-current", ARC_CLASS[tone])}
						/>
					</svg>
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				side="top"
				className="w-64 max-w-[calc(100vw-24px)] p-3"
			>
				<p className="font-grotesk font-semibold text-[13px]">{title}</p>
				<p className="mt-0.5 font-grotesk text-[12px] text-popover-foreground/60 tabular-nums">
					{t("appBuilder.chat.context.tokens", {
						tokens: formatNumber(usage.tokens, locale),
						limit: formatNumber(usage.compactAtTokens, locale),
					})}
				</p>
				<p className="mt-2 font-sans text-[12px] text-popover-foreground/75 leading-snug">
					{t("appBuilder.chat.context.hint")}
				</p>
				{/* A new conversation starts with an empty context, so the offer shows only near the limit. */}
				{tone !== "neutral" && onCreateChat ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onCreateChat}
						className="mt-2.5 h-8 w-full font-grotesk font-medium text-[13px]"
					>
						{t("appBuilder.chat.context.newConversation")}
					</Button>
				) : null}
			</PopoverContent>
		</Popover>
	);
}
