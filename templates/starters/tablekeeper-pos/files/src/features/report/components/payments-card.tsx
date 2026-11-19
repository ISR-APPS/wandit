// The "Payments" card of the day report, as the kit visits-by-source card: one donut with a legend.
// ReportPage renders it in the middle of the third band. The ring counts the checks per payment.
// The donut loads with React.lazy from report-charts.tsx.
import { lazy, Suspense } from "react";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { PaymentRow } from "../lib/day-report";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const PaymentsDonut = lazy(() =>
	import("./report-charts").then((module) => ({
		default: module.PaymentsDonut,
	})),
);

type PaymentsCardProps = {
	/** Card, cash, and the open checks, in this order. */
	rows: PaymentRow[];
};

/** The screen reader label lists each payment with its number of checks. */
export function PaymentsCard({ rows }: PaymentsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const label = `${t("report.payments")}: ${rows
		.map(
			(row) =>
				`${row.method === "open" ? t("report.openChecks") : t(`payments.${row.method}`)} ${number.format(row.checks)}`,
		)
		.join(", ")}`;

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("report.payments")}</CardTitle>
			</CardHeader>
			<CardContent>
				<Suspense
					fallback={
						<Skeleton className="mx-auto aspect-square max-h-80 w-full" />
					}
				>
					<PaymentsDonut rows={rows} label={label} />
				</Suspense>
			</CardContent>
		</Card>
	);
}
