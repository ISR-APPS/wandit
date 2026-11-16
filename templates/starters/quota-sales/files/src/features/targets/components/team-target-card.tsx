// The team line of the targets page: the attainment with its bar, then the target facts of the quarter.
// TargetsPage renders it first, full width.
import {
	AttainmentBar,
	fillMessage,
	moneyFormat,
	PaceBadge,
	percentFormat,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { QuarterTargets } from "../api/targets.queries";

type TeamTargetCardProps = {
	targets: QuarterTargets;
};

/** One Card: the big attainment on the start side, the facts in a grid beside it from the 4xl container width. */
export function TeamTargetCard({ targets }: TeamTargetCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const percent = percentFormat(locale);
	const { team } = targets;
	const gap = team.target - team.booked;
	const facts = [
		{
			id: "target",
			label: t("targets.teamTarget"),
			value: money.format(team.target),
		},
		{
			id: "booked",
			label: t("targets.booked"),
			value: money.format(team.booked),
		},
		{
			id: "expected",
			label: t("targets.expectedByToday"),
			value: money.format(team.expectedByToday),
		},
		{
			id: "gap",
			label: gap > 0 ? t("targets.gap") : t("targets.overTarget"),
			value: money.format(Math.abs(gap)),
		},
		{
			id: "needed",
			label: t("targets.neededPerDay"),
			value:
				targets.isClosed || gap <= 0
					? "–"
					: money.format(team.neededPerSellingDay),
		},
		{
			id: "days-left",
			label: t("targets.sellingDaysLeft"),
			value: new Intl.NumberFormat(locale).format(team.sellingDaysLeft),
		},
	];
	return (
		<Card>
			<CardHeader>
				<CardTitle>{`${t("targets.teamTitle")} · ${targets.quarterLabel}`}</CardTitle>
			</CardHeader>
			<CardContent className="grid @4xl/main:grid-cols-[minmax(0,20rem)_1fr] @4xl/main:gap-10 gap-6">
				<div className="grid content-start gap-3">
					<div className="flex items-center gap-3">
						<p className="font-numeric font-semibold text-5xl tabular-nums leading-none">
							{percent.format(team.attainment)}
						</p>
						<PaceBadge status={team.status} />
					</div>
					<p className="text-muted-foreground text-sm">
						{t("targets.ofTarget")}
					</p>
					<AttainmentBar
						attainment={team.attainment}
						pace={targets.progress.pace}
						status={team.status}
						label={fillMessage(t("reps.ofTarget"), {
							value: percent.format(team.attainment),
						})}
						className="h-3"
					/>
				</div>
				<dl className="grid @xl/main:grid-cols-3 grid-cols-2 gap-x-6 gap-y-5">
					{facts.map((fact) => (
						<div key={fact.id} className="grid content-start gap-1">
							<dt className="text-muted-foreground text-sm">{fact.label}</dt>
							<dd className="font-numeric font-semibold text-xl tabular-nums">
								{fact.value}
							</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}
