/**
 * Card of a next step the agent proposes. It shows a lightbulb medallion, a
 * title, a body, a three-bar confidence meter, and the Alternatives and
 * Accept pills.
 * Rendered by chat-message.tsx for each `data-suggestion` part.
 * Pure presentation: the caller owns every action.
 */

import { LightbulbIcon } from "@phosphor-icons/react/Lightbulb";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";
import type { BuilderConfidence } from "../../api/dto";
import {
	CARD_PRIMARY_PILL_CLASS,
	CARD_SECONDARY_PILL_CLASS,
	CardMedallion,
	MessageCard,
} from "./message-card";

/** Props of one `data-suggestion` part, as chat-message.tsx passes them. */
export type SuggestionCardProps = {
	/** One line the agent proposes, for example "Want me to add a push reminder?". */
	title: string;
	/** What the agent does when the user accepts, one or two sentences. */
	body: string;
	/** How sure the agent is. Sets how many of the three bars are filled. */
	confidence: BuilderConfidence;
	onAccept: () => void;
	onAlternatives: () => void;
};

/** Filled bars of the meter per confidence level, out of three. */
const BARS: Record<BuilderConfidence, number> = { high: 3, medium: 2, low: 1 };

/**
 * Height of each of the three meter bars, from the first to the last. The
 * bars climb like a signal meter: 6, 9, then 12 px.
 */
const BAR_HEIGHT_CLASSES = ["h-1.5", "h-[9px]", "h-3"] as const;

/** Draws one, two, or three green bars for low, medium, or high confidence. */
export function SuggestionCard({
	title,
	body,
	confidence,
	onAccept,
	onAlternatives,
}: SuggestionCardProps) {
	const { t } = useTranslation();
	const filledBars = BARS[confidence];

	return (
		<MessageCard className="flex items-start gap-3">
			<CardMedallion icon={LightbulbIcon} tone="neutral" />
			<div className="min-w-0 flex-1 pt-0.5">
				<p
					dir="auto"
					className="font-grotesk font-semibold text-[14px] text-night leading-snug dark:text-foreground"
				>
					{title}
				</p>
				<p
					dir="auto"
					className="mt-1 font-sans text-[14px] text-night/70 leading-relaxed dark:text-foreground/70"
				>
					{body}
				</p>
				<div className="mt-3 flex flex-wrap items-center gap-2">
					<span className="flex items-center gap-1.5 font-grotesk text-[12px] text-night/50 dark:text-foreground/50">
						<span aria-hidden className="flex items-end gap-0.5">
							{BAR_HEIGHT_CLASSES.map((heightClass, position) => {
								// A bar below the filled count is green.
								const isFilled = position < filledBars;
								return (
									<span
										key={heightClass}
										data-filled={isFilled ? "true" : "false"}
										className={cn(
											"w-1 rounded-full",
											heightClass,
											isFilled
												? "bg-success"
												: "bg-night/[0.12] dark:bg-white/[0.14]",
										)}
									/>
								);
							})}
						</span>
						{t(`appBuilder.chat.suggestion.confidence.${confidence}`)}
					</span>
					<div className="ms-auto flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={onAlternatives}
							className={CARD_SECONDARY_PILL_CLASS}
						>
							{t("appBuilder.chat.suggestion.alternatives")}
						</Button>
						<Button
							size="sm"
							onClick={onAccept}
							className={CARD_PRIMARY_PILL_CLASS}
						>
							{t("appBuilder.chat.suggestion.accept")}
						</Button>
					</div>
				</div>
			</div>
		</MessageCard>
	);
}
