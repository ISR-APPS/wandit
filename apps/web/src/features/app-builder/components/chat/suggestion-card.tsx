/**
 * Card of a next step the agent proposes. It shows a title, a body, a
 * three-bar confidence meter, and the Alternatives and Accept actions.
 * Rendered by chat-message.tsx for each `data-suggestion` part.
 * Pure presentation: the caller owns every action.
 */

import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";
import type { BuilderConfidence } from "../../api/dto";
import { MessageCard } from "./message-card";

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

/** The meter always draws three bars. A bar below the filled count is green. */
const BAR_POSITIONS = [0, 1, 2] as const;

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
		<MessageCard className="p-4">
			<p dir="auto" className="font-semibold text-sm">
				{title}
			</p>
			<p dir="auto" className="mt-1.5 text-sm leading-relaxed">
				{body}
			</p>
			<div className="mt-3 flex flex-wrap items-center gap-2">
				<span className="flex items-center gap-1.5 text-muted-foreground text-xs">
					{BAR_POSITIONS.map((position) => {
						const isFilled = position < filledBars;
						return (
							<span
								key={position}
								data-filled={isFilled ? "true" : "false"}
								className={cn(
									"h-3 w-1 rounded-sm",
									isFilled ? "bg-success" : "bg-stone",
								)}
								aria-hidden
							/>
						);
					})}
					{t(`appBuilder.chat.suggestion.confidence.${confidence}`)}
				</span>
				<div className="ms-auto flex gap-2">
					<Button variant="outline" size="sm" onClick={onAlternatives}>
						{t("appBuilder.chat.suggestion.alternatives")}
					</Button>
					<Button size="sm" onClick={onAccept}>
						{t("appBuilder.chat.suggestion.accept")}
					</Button>
				</div>
			</div>
		</MessageCard>
	);
}
