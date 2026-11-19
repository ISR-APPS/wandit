// The team card of the dashboard: the people of the firm and three highlights of the period.
// DashboardPage renders it at 1/3 width beside the hours card, in the place of the kit "professionals" card.
// Each highlight shows an arrow in a success or destructive color and its value. The row label names it.
import {
	ArrowDownRightIcon,
	ArrowUpRightIcon,
	MinusIcon,
} from "@phosphor-icons/react";
import { moneyFormat, PersonAvatar } from "~/features/practice";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { DashboardSummary, Figure } from "../lib/dashboard";

// A change under 0.05 % rounds to "0%", so it shows a flat dash, not an arrow.
const FLAT_CHANGE = 0.0005;

type TeamCardProps = {
	team: DashboardSummary["team"];
};

/** A higher value is good news for all three highlights. */
export function TeamCard({ team }: TeamCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const rows: { id: string; label: string; figure: Figure; text: string }[] = [
		{
			id: "collected",
			label: t("dashboard.collected"),
			figure: team.collected,
			text: money.format(team.collected.value),
		},
		{
			id: "rate",
			label: t("dashboard.averageRate"),
			figure: team.averageRate,
			text: money.format(team.averageRate.value),
		},
		{
			id: "share",
			label: t("dashboard.billableShare"),
			figure: team.billableShare,
			text: percent.format(team.billableShare.value),
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardDescription>{t("dashboard.feeEarners")}</CardDescription>
				<CardTitle className="font-numeric text-3xl tabular-nums">
					{new Intl.NumberFormat(locale).format(team.names.length)}
				</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-6">
				<div className="grid gap-3">
					<p className="font-medium text-sm">{t("dashboard.topBillers")}</p>
					<ul className="flex -space-x-2">
						{team.names.map((name) => (
							<li key={name} title={name}>
								<PersonAvatar
									name={name}
									className="size-10 ring-2 ring-card"
								/>
								<span className="sr-only">{name}</span>
							</li>
						))}
					</ul>
				</div>
				<div className="grid gap-1">
					<p className="font-medium text-sm">{t("dashboard.highlights")}</p>
					<ul className="grid">
						{rows.map((row) => {
							const change = row.figure.change;
							const isFlat = change === null || Math.abs(change) < FLAT_CHANGE;
							const TrendIcon = isFlat
								? MinusIcon
								: change < 0
									? ArrowDownRightIcon
									: ArrowUpRightIcon;
							return (
								<li
									key={row.id}
									className="flex items-center justify-between gap-3 border-b py-3 text-sm last:border-b-0"
								>
									<span className="text-muted-foreground">{row.label}</span>
									<span className="flex items-center gap-1.5 font-medium tabular-nums">
										<TrendIcon
											className={cn(
												"size-4 rtl:-scale-x-100",
												isFlat
													? "text-muted-foreground"
													: change > 0
														? "text-success"
														: "text-destructive",
											)}
										/>
										<span className="sr-only">
											{isFlat
												? t("dashboard.trendFlat")
												: change > 0
													? t("dashboard.trendUp")
													: t("dashboard.trendDown")}
										</span>
										{row.text}
									</span>
								</li>
							);
						})}
					</ul>
				</div>
			</CardContent>
		</Card>
	);
}
