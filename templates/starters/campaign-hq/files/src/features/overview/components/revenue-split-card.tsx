// The revenue card of the home: the revenue of the period, a trend arrow, and its split between paid and owned.
// OverviewPage renders it in the second row and passes the period data.
// Paid media are the social, search, and video ads. Owned channels are the email list and the creator partners.
import { moneyFormat } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
} from "~/shared/ui/card";
import type { Overview } from "../api/overview.queries";
import { TrendMark } from "./trend-mark";

type RevenueSplitCardProps = {
	/** The data of the chosen period. */
	overview: Overview;
};

/** The split bar has two segments, and each one also has its percent and name above it. */
export function RevenueSplitCard({ overview }: RevenueSplitCardProps) {
	const { t, locale } = useT();
	const { paid, owned, change } = overview.revenue;
	const total = paid + owned;
	const money = moneyFormat(locale, "compact");
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});
	const paidShare = total === 0 ? 0 : paid / total;
	const ownedShare = total === 0 ? 0 : owned / total;

	return (
		<Card className="h-full">
			<CardHeader>
				<CardDescription>{t("overview.revenueTitle")}</CardDescription>
				<p className="mb-6 font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
					{money.format(total)}
				</p>
				<TrendMark change={change} />
			</CardHeader>
			<CardContent className="mt-auto">
				<div className="grid grid-cols-2 gap-4 divide-x rtl:divide-x-reverse">
					<div className="flex items-center gap-3 text-sm">
						<Badge variant="secondary" className="border-border tabular-nums">
							{percent.format(paidShare)}
						</Badge>
						<span>{t("overview.paidMedia")}</span>
					</div>
					<div className="flex items-center justify-end gap-3 text-sm">
						<Badge variant="secondary" className="border-border tabular-nums">
							{percent.format(ownedShare)}
						</Badge>
						<span>{t("overview.ownedChannels")}</span>
					</div>
				</div>
				<div
					className="mt-4 flex h-4 overflow-hidden rounded-md bg-muted"
					role="img"
					aria-label={`${t("overview.paidMedia")} ${percent.format(paidShare)}, ${t("overview.ownedChannels")} ${percent.format(ownedShare)}`}
				>
					<span
						className="bg-chart-1"
						style={{ width: `${paidShare * 100}%` }}
					/>
					<span
						className="bg-chart-3"
						style={{ width: `${ownedShare * 100}%` }}
					/>
				</div>
			</CardContent>
		</Card>
	);
}
