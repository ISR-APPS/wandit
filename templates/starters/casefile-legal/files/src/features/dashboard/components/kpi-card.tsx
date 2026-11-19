// One KPI card of the dashboard in the "ruled" variant of the kit system: the label as the card title with an
// icon chip at the end, a rule under the head, then the value with a delta badge beside it.
// DashboardPage renders three of them after the target card.
import { ArrowDownRightIcon, ArrowUpRightIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";

// One decimal shows 0.05 % and more. A smaller change shows "0%", so it gets no arrow and no color.
const FLAT_CHANGE = 0.0005;

type KpiCardProps = {
	label: string;
	/** The formatted value, for example "$48,200" or "40". */
	value: string;
	/** Ratio against the start of the period: 0.12 is +12 %. null shows "No earlier data". */
	change: number | null;
	/** "down" for a figure where a fall is good news, for example overdue money. */
	goodWhen: "up" | "down";
	/** One short line under the value that differs per card, for example "6 opened in this period". */
	context: string;
	icon: KitIcon;
};

/** The badge holds the signed percent and an arrow. The color repeats the good or bad news of `goodWhen`. */
export function KpiCard({
	label,
	value,
	change,
	goodWhen,
	context,
	icon: Icon,
}: KpiCardProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const isFlat = change !== null && Math.abs(change) < FLAT_CHANGE;
	const isGood = change !== null && change > 0 === (goodWhen === "up");
	const ArrowIcon =
		change !== null && change < 0 ? ArrowDownRightIcon : ArrowUpRightIcon;

	return (
		<Card className="gap-4">
			<CardHeader className="items-center border-b pb-4">
				<CardTitle>{label}</CardTitle>
				<CardAction>
					<span className="flex size-8 items-center justify-center rounded-full border bg-muted">
						<Icon className="size-4" />
					</span>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-1">
				<div className="flex flex-wrap items-center gap-2">
					<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
						{value}
					</p>
					{change === null ? null : (
						<Badge
							variant="outline"
							className={cn(
								"gap-1 tabular-nums",
								isFlat
									? "text-muted-foreground"
									: isGood
										? "text-success"
										: "text-destructive",
							)}
						>
							{/* dir="ltr" keeps "+12%" in this order in an Arabic page. */}
							<bdi dir="ltr">{percent.format(change)}</bdi>
							{isFlat ? null : <ArrowIcon className="rtl:-scale-x-100" />}
							<span className="sr-only">{t("kpi.vsStart")}</span>
						</Badge>
					)}
				</div>
				<p className="text-muted-foreground text-sm">
					{change === null ? t("kpi.noComparison") : context}
				</p>
			</CardContent>
		</Card>
	);
}
