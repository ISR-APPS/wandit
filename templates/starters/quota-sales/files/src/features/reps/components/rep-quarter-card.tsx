// The facts of one rep for the current quarter: target, booked, gap, orders, average order, and the needed run rate.
// RepDetailPage renders it first. It also shows the start date of the rep.
import { moneyFormat } from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { RepDetail } from "../api/reps.queries";

type RepQuarterCardProps = {
	rep: RepDetail;
};

/** A grid of facts: 2 columns on a phone, 4 on a wide page. */
export function RepQuarterCard({ rep }: RepQuarterCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, {
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	});
	const gap = rep.target - rep.booked;
	const facts = [
		{ id: "target", label: t("reps.target"), value: money.format(rep.target) },
		{ id: "booked", label: t("reps.booked"), value: money.format(rep.booked) },
		{
			id: "expected",
			label: t("reps.expectedByToday"),
			value: money.format(rep.expectedByToday),
		},
		{
			id: "gap",
			label: t("reps.gap"),
			value: gap > 0 ? money.format(gap) : t("reps.targetMet"),
		},
		{
			id: "needed",
			label: t("reps.neededPerDay"),
			value: gap > 0 ? money.format(rep.neededPerSellingDay) : "–",
		},
		{ id: "orders", label: t("reps.orders"), value: number.format(rep.orders) },
		{
			id: "average",
			label: t("reps.averageOrder"),
			value: money.format(rep.averageOrder),
		},
		{
			id: "started",
			label: t("reps.started"),
			value: date.format(new Date(`${rep.startedOn}T00:00:00Z`)),
		},
	];
	return (
		<Card>
			<CardHeader>
				<CardTitle>{`${t("reps.quarterFacts")} · ${rep.quarterLabel}`}</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className="grid @2xl/main:grid-cols-4 grid-cols-2 gap-x-6 gap-y-5">
					{facts.map((fact) => (
						// content-between keeps the values of one row on one line when a label wraps.
						<div key={fact.id} className="grid content-between gap-1">
							<dt className="text-muted-foreground text-sm">{fact.label}</dt>
							<dd className="font-numeric font-semibold text-lg tabular-nums">
								{fact.value}
							</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}
