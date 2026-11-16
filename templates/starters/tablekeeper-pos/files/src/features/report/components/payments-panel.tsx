// The "Payments" panel of the day report: card, cash, and the checks still open, with their share of the sales.
// ReportPage renders it beside the sales by hour. The 3 rows add up to the gross sales in the footer.
// It reads the payment rows, the gross sales, and the tips of the day report. It writes nothing.
import { CreditCardIcon, MoneyIcon, ReceiptIcon } from "@phosphor-icons/react";
import { fillMessage, formatCents, moneyFormat } from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { PaymentRow } from "../lib/day-report";

/** One icon per row, named after how the guest pays. */
const METHOD_ICONS = {
	card: CreditCardIcon,
	cash: MoneyIcon,
	open: ReceiptIcon,
} satisfies Record<PaymentRow["method"], KitIcon>;

type PaymentsPanelProps = {
	rows: PaymentRow[];
	/** Sales of the day in cents, tips excluded. The footer total. */
	grossCents: number;
	/** Card tips of the day in cents. They are not in the sales. */
	tipsCents: number;
};

/** A Card with 3 rows. A bar behind each row shows its share of the gross sales. */
export function PaymentsPanel({
	rows,
	grossCents,
	tipsCents,
}: PaymentsPanelProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("report.payments")}</CardTitle>
			</CardHeader>
			<CardContent className="grid flex-1 content-start gap-4">
				{rows.map((row) => {
					const Icon = METHOD_ICONS[row.method];
					const share = grossCents > 0 ? row.salesCents / grossCents : 0;
					return (
						<div key={row.method} className="grid gap-2">
							<div className="flex items-center gap-3">
								<span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-muted text-muted-foreground">
									<Icon className="size-4" />
								</span>
								<span className="grid min-w-0 flex-1">
									<span className="font-medium text-sm">
										{row.method === "open"
											? t("report.openChecks")
											: t(`payments.${row.method}`)}
									</span>
									<span className="text-muted-foreground text-xs tabular-nums">
										{fillMessage(
											t(
												row.checks === 1
													? "report.oneCheck"
													: "report.paidChecks",
											),
											{
												count: String(row.checks),
											},
										)}
									</span>
								</span>
								<span className="grid justify-items-end">
									<span className="font-medium text-sm tabular-nums">
										{formatCents(money, row.salesCents)}
									</span>
									<span className="text-muted-foreground text-xs tabular-nums">
										{percent.format(share)}
									</span>
								</span>
							</div>
							<div className="h-1.5 overflow-hidden rounded-full bg-muted">
								{/* The width is the share of the gross sales. It grows from the start side. */}
								<div
									className={
										row.method === "open"
											? "h-full rounded-full bg-chart-1/40"
											: "h-full rounded-full bg-chart-1"
									}
									style={{ width: `${share * 100}%` }}
								/>
							</div>
						</div>
					);
				})}
			</CardContent>
			<CardFooter className="grid gap-1.5 border-t pt-4 text-sm">
				<div className="flex items-baseline justify-between gap-4">
					<span className="font-medium">{t("report.grossSales")}</span>
					<span className="font-numeric font-semibold text-lg tabular-nums">
						{formatCents(money, grossCents)}
					</span>
				</div>
				<div className="flex items-baseline justify-between gap-4 text-muted-foreground">
					<span>{t("report.tips")}</span>
					<span className="tabular-nums">{formatCents(money, tipsCents)}</span>
				</div>
			</CardFooter>
		</Card>
	);
}
