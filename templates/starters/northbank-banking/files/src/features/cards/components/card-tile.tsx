// One card on the cards page: its face, its holder, its status, and its spend this month against the limit.
// CardsPage renders one tile per card. The whole tile opens the card detail page.
import { Link } from "@tanstack/react-router";
import {
	dayFormat,
	dayToDate,
	fillMessage,
	MoneyText,
	relativeDayLabel,
	todayIsoDay,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { CardSummary } from "../lib/card-spend";
import { CardFace } from "./card-face";
import { CardStatusBadge } from "./card-status-badge";

type CardTileProps = {
	summary: CardSummary;
};

/** The holder link stretches over the tile, so a click anywhere opens the detail page. */
export function CardTile({ summary }: CardTileProps) {
	const { t, locale } = useT();
	const { card, status } = summary;
	const today = todayIsoDay();
	const longDay = dayFormat(locale, "long");
	const footer =
		status === "active"
			? summary.lastUsedDay
				? fillMessage(t("cards.lastUsed"), {
						when: relativeDayLabel(summary.lastUsedDay, today, locale),
					})
				: t("cards.neverUsed")
			: fillMessage(t(`cards.statusSince.${status}`), {
					day: longDay.format(dayToDate(summary.statusSince)),
				});

	return (
		// Two rows: the second takes the extra height of a row of tiles, and the spend sits at its end.
		// So the bars of two tiles side by side stay on one line.
		<Card className="relative grid grid-rows-[auto_1fr] gap-4 py-5 transition-colors hover:bg-accent/40">
			<CardContent className="flex items-start gap-4 px-5">
				<CardFace
					numberEnding={card.numberEnding}
					holderName={card.holderName}
					expiry={summary.expiry}
					isVirtual={card.kind === "virtual"}
					isInactive={status !== "active"}
					size="small"
				/>
				<div className="grid min-w-0 flex-1 gap-0.5">
					<Link
						to="/app/cards/$cardId"
						params={{ cardId: card.id }}
						className="text-pretty font-medium after:absolute after:inset-0 focus-visible:outline-none"
					>
						{card.kind === "virtual"
							? t("cards.roles.software")
							: card.holderName}
					</Link>
					<span className="text-pretty text-muted-foreground text-sm">
						{card.kind === "virtual"
							? fillMessage(t("cards.virtualLine"), { name: card.holderName })
							: t(`cards.roles.${card.role}`)}
					</span>
				</div>
			</CardContent>
			<CardContent className="grid gap-2 self-end px-5">
				<div className="flex items-baseline justify-between gap-3 text-sm">
					<span className="text-muted-foreground">
						{t("cards.spentThisMonth")}
					</span>
					<span>
						<MoneyText
							amountCents={summary.monthSpendCents}
							withCents={false}
							className="font-medium"
						/>
						<span className="text-muted-foreground">
							{` ${t("cards.of")} `}
							<MoneyText
								amountCents={card.monthlyLimitCents}
								withCents={false}
							/>
						</span>
					</span>
				</div>
				<Progress
					value={summary.monthSpendCents}
					max={card.monthlyLimitCents}
					aria-label={t("cards.spentThisMonth")}
				/>
				{/* The badge sits in the last row, so the holder name keeps the full width beside the face. */}
				<div className="flex items-center justify-between gap-3">
					<p className="text-muted-foreground text-xs">{footer}</p>
					<CardStatusBadge status={status} />
				</div>
			</CardContent>
		</Card>
	);
}
