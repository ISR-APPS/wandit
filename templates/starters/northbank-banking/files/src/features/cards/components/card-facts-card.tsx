// The face of one card and its facts: holder, role, account, issue day, expiry, and status day.
// CardDetailPage renders it beside the spend chart.
import {
	accountOf,
	addDays,
	dayFormat,
	dayToDate,
	todayIsoDay,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import type { CardDetail } from "../lib/card-spend";
import { CardFace } from "./card-face";

type DetailCardProps = {
	/** The card, its payments, and its top merchants, from cardDetailQueryOptions. */
	detail: CardDetail;
};

/** The card face and the facts of the card. */
export function CardFactsCard({ detail }: DetailCardProps) {
	const { t, locale } = useT();
	const { card, status, expiry, statusSince } = detail.summary;
	const longDay = dayFormat(locale, "long");
	const today = todayIsoDay();
	const operating = accountOf("operating");
	const facts = [
		{
			id: "holder",
			label: t("cards.holder"),
			value: card.holderName,
		},
		{
			id: "role",
			label: t("cards.role"),
			value: t(`cards.roles.${card.role}`),
		},
		{
			id: "account",
			label: t("transactions.account"),
			value: `${t("accounts.operating")} ••${operating.numberEnding}`,
		},
		{
			id: "issued",
			label: t("cards.issued"),
			value: longDay.format(dayToDate(addDays(today, -card.issuedDaysAgo))),
		},
		{ id: "expires", label: t("cards.expires"), value: expiry },
	];
	if (status !== "active") {
		facts.push({
			id: "since",
			label: t(`cards.statuses.${status}`),
			value: longDay.format(dayToDate(statusSince)),
		});
	}
	return (
		<Card>
			{/* Between 42rem and 56rem the card is as wide as the page, so the face and the facts sit side by side. */}
			<CardContent className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-1 items-center gap-5">
				<CardFace
					numberEnding={card.numberEnding}
					holderName={card.holderName}
					expiry={expiry}
					isVirtual={card.kind === "virtual"}
					isInactive={status !== "active"}
					size="large"
				/>
				<dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
					{facts.map((fact) => (
						// content-start: a value that wraps makes its row taller, and the short value beside it stays under its label.
						<div key={fact.id} className="grid content-start gap-0.5">
							<dt className="text-muted-foreground">{fact.label}</dt>
							<dd className="tabular-nums">{fact.value}</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}
