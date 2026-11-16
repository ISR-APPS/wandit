// The monthly plan of the targets page: the 3 months of the quarter with their target, booked amount, and state.
// TargetsPage renders it in the 1/3 column. The target of a month is a fixed share of the team target.
// The bar of a month uses the pace rule of the whole board, with the share of the month that has passed.
import type { VariantProps } from "class-variance-authority";
import {
	AttainmentBar,
	fillMessage,
	moneyFormat,
	paceStatusOf,
	percentFormat,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Badge, type badgeVariants } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { MonthState, MonthTarget } from "../api/targets.queries";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Badge variant per month state. */
const MONTH_STATE_BADGE = {
	closed: "secondary",
	current: "info",
	upcoming: "outline",
} satisfies Record<MonthState, BadgeVariant>;

type MonthlyPlanCardProps = {
	/** The 3 months of the quarter, oldest first. */
	months: MonthTarget[];
};

/** One block per month, then the quarter target and a note on the split. An upcoming month shows its target only. */
export function MonthlyPlanCard({ months }: MonthlyPlanCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale, { compact: true });
	const moneyFull = moneyFormat(locale);
	const percent = percentFormat(locale);
	const quarterTarget = months.reduce((sum, month) => sum + month.target, 0);
	const monthLabel = new Intl.DateTimeFormat(locale, {
		month: "long",
		timeZone: "UTC",
	});
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("targets.monthsTitle")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-6">
				<ul className="grid gap-5">
					{months.map((month) => (
						<li key={month.monthStart} className="grid gap-2">
							<div className="flex items-center justify-between gap-3">
								<div className="flex items-baseline gap-2">
									<span className="font-medium">
										{monthLabel.format(
											new Date(`${month.monthStart}T00:00:00Z`),
										)}
									</span>
									<span className="text-muted-foreground text-xs tabular-nums">
										{fillMessage(t("targets.monthShare"), {
											share: percent.format(month.share),
										})}
									</span>
								</div>
								<Badge variant={MONTH_STATE_BADGE[month.state]}>
									{t(`targets.monthStates.${month.state}`)}
								</Badge>
							</div>
							<div className="flex items-baseline justify-between gap-3 text-sm">
								<span className="text-muted-foreground tabular-nums">
									{month.state === "upcoming"
										? `${t("targets.target")} ${money.format(month.target)}`
										: `${money.format(month.booked)} / ${money.format(month.target)}`}
								</span>
								{month.state === "upcoming" ? null : (
									<span className="font-semibold tabular-nums">
										{percent.format(month.attainment)}
									</span>
								)}
							</div>
							{/* An upcoming month has no pace yet, so its bar is an empty track with no mark. */}
							<AttainmentBar
								attainment={month.attainment}
								pace={month.state === "upcoming" ? 1 : month.pace}
								status={paceStatusOf(month.attainment, month.pace)}
								label={fillMessage(t("targets.monthOfTarget"), {
									value: percent.format(month.attainment),
								})}
							/>
						</li>
					))}
				</ul>
				<div className="grid gap-2 border-t pt-4">
					<div className="flex items-baseline justify-between gap-3 text-sm">
						<span className="text-muted-foreground">
							{t("targets.quarterTarget")}
						</span>
						<span className="font-numeric font-semibold text-lg tabular-nums">
							{moneyFull.format(quarterTarget)}
						</span>
					</div>
					<p className="text-muted-foreground text-xs">
						{t("targets.monthsNote")}
					</p>
				</div>
			</CardContent>
		</Card>
	);
}
