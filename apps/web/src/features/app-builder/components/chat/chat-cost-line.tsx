/**
 * The cost line of the whole chat: the provider cost in USD, the credits,
 * and the turn count. A click opens the split per model, so a user can
 * compare models. Rendered by chat-pane.tsx under the composer. The data
 * comes from `GET /api/v2/projects/:id/chats/:chatId/cost`.
 */

import { CoinsIcon } from "@phosphor-icons/react/Coins";
import {
	type ChatCostResponse,
	centiCreditsToCredits,
} from "@wandit/contracts";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@wandit/ui/components/popover";
import { cn } from "@wandit/ui/lib/utils";

import { formatCreditAmount } from "@/features/credits";
import { formatNumber, useTranslation } from "@/lib/i18n";
import { getModelLabel } from "@/lib/model-labels";
import { formatUsdMicros } from "../../lib/helpers";

// The muted 11 px look of the receipt line in chat-message.tsx.
const LINE_CLASS =
	"flex items-center gap-1.5 font-grotesk text-[11px] text-night/45 tabular-nums dark:text-foreground/45";

/** One line under the composer. With no model row it is plain text and opens nothing. */
export function ChatCostLine({
	cost,
}: {
	/** The chat cost answer: USD micros, centi-credits, the turn count, and one row per model. */
	cost: ChatCostResponse;
}) {
	const { t, locale } = useTranslation();
	const credits = centiCreditsToCredits(cost.credits);
	const content = (
		<>
			<CoinsIcon weight="fill" className="size-3 shrink-0" aria-hidden />
			{t("appBuilder.chat.cost.line", {
				usd: formatUsdMicros(cost.usdMicros, locale),
				credits: t("appBuilder.chat.cost.credits", {
					count: credits,
					countDisplay: formatCreditAmount(credits, locale),
				}),
				turns: t("appBuilder.chat.cost.turns", {
					count: cost.turnCount,
					countDisplay: formatNumber(cost.turnCount, locale),
				}),
			})}
		</>
	);
	// Every turn of the chat can fail before its first model call. The split then has no row.
	if (cost.byModel.length === 0) {
		return <p className={LINE_CLASS}>{content}</p>;
	}
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						LINE_CLASS,
						"rounded-full outline-none transition-colors hover:text-night focus-visible:ring-2 focus-visible:ring-ember/40 dark:hover:text-foreground",
					)}
				>
					{content}
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				side="top"
				className="w-auto min-w-56 max-w-[calc(100vw-24px)] p-3"
			>
				<p className="font-grotesk font-semibold text-popover-foreground/60 text-xs">
					{t("appBuilder.chat.cost.byModel")}
				</p>
				<ul className="mt-1.5 flex flex-col gap-1 font-grotesk text-[12px] tabular-nums">
					{cost.byModel.map((row) => (
						<li key={row.model}>
							{t("appBuilder.chat.cost.row", {
								model: getModelLabel(row.model),
								usd: formatUsdMicros(row.usdMicros, locale),
								requests: t("appBuilder.chat.cost.requests", {
									count: row.requestCount,
									countDisplay: formatNumber(row.requestCount, locale),
								}),
							})}
						</li>
					))}
				</ul>
			</PopoverContent>
		</Popover>
	);
}
