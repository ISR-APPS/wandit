// The "Tax" panel of the day report: the VAT inside the sales per rate, the net sales, and the voids.
// ReportPage renders it beside the servers. Menu prices include VAT, so net = gross - VAT.
// It reads the VAT rows and the voids of the day report. It writes nothing.
import { fillMessage, formatCents, moneyFormat } from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Separator } from "~/shared/ui/separator";
import type { VatRow } from "../lib/day-report";

type TaxPanelProps = {
	/** The VAT rates, the lowest first. */
	rows: VatRow[];
	/** Checks voided today and their amount in cents. They are not in the sales. */
	voids: { checks: number; cents: number };
};

/** A Card with one block per VAT rate, the net total, and one line for the voids. */
export function TaxPanel({ rows, voids }: TaxPanelProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
	const netCents = rows.reduce((sum, row) => sum + row.netCents, 0);
	const vatCents = rows.reduce((sum, row) => sum + row.vatCents, 0);

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("report.tax")}</CardTitle>
			</CardHeader>
			<CardContent className="grid content-start gap-4 text-sm">
				<dl className="grid gap-2.5">
					{rows.map((row) => (
						<div
							key={row.rate}
							className="flex items-baseline justify-between gap-4"
						>
							<dt className="grid">
								<span>
									{fillMessage(t("report.vatAt"), {
										rate: percent.format(row.rate),
									})}
								</span>
								<span className="text-muted-foreground text-xs tabular-nums">
									{fillMessage(t("report.vatOn"), {
										amount: formatCents(money, row.grossCents),
									})}
								</span>
							</dt>
							<dd className="font-medium tabular-nums">
								{formatCents(money, row.vatCents)}
							</dd>
						</div>
					))}
					<div className="flex items-baseline justify-between gap-4 border-t pt-2.5">
						<dt className="text-muted-foreground">{t("report.vatTotal")}</dt>
						<dd className="font-medium tabular-nums">
							{formatCents(money, vatCents)}
						</dd>
					</div>
					<div className="flex items-baseline justify-between gap-4">
						<dt className="font-medium">{t("report.netSales")}</dt>
						<dd className="font-numeric font-semibold text-lg tabular-nums">
							{formatCents(money, netCents)}
						</dd>
					</div>
				</dl>
				<Separator />
				<div className="flex items-baseline justify-between gap-4">
					<span className="grid">
						<span>{t("report.voids")}</span>
						<span className="text-muted-foreground text-xs">
							{fillMessage(
								t(
									voids.checks === 1
										? "report.voidsHintOne"
										: "report.voidsHint",
								),
								{
									count: String(voids.checks),
								},
							)}
						</span>
					</span>
					<span className="text-muted-foreground tabular-nums line-through">
						{formatCents(money, voids.cents)}
					</span>
				</div>
			</CardContent>
		</Card>
	);
}
