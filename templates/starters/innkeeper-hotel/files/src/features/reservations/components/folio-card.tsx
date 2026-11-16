// The folio of one reservation: the charges, the payments, and the totals.
// ReservationDetailPage renders it in the main column. It reads the rows of the detail query.
import {
	dayToDate,
	type FolioCharge,
	moneyFormat,
	type Payment,
} from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import type { ReservationRow } from "../api/reservations.queries";

type FolioCardProps = {
	/** The reservation of the folio. Its `total`, `paid`, and `balance` are the sums of the rows below. */
	reservation: ReservationRow;
	/** The folio lines: the stay charges, then the extras by date. */
	charges: FolioCharge[];
	/** The payments, oldest first. A refund has a negative amount. */
	payments: Payment[];
};

/** A Card with two tables and a totals block. A cancelled stay has no charge, so it shows one sentence. */
export function FolioCard({ reservation, charges, payments }: FolioCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const chargesTotal = charges.reduce((sum, charge) => sum + charge.amount, 0);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("folio.title")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-6">
				{charges.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("folio.noCharges")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("folio.item")}</TableHead>
								<TableHead>{t("folio.date")}</TableHead>
								<TableHead className="text-end">
									{t("folio.quantity")}
								</TableHead>
								<TableHead className="text-end">
									{t("folio.unitPrice")}
								</TableHead>
								<TableHead className="text-end">{t("folio.amount")}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{charges.map((charge) => (
								<TableRow key={charge.id}>
									<TableCell className="font-medium">
										{t(`folio.kinds.${charge.kind}`)}
									</TableCell>
									<TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
										{date.format(dayToDate(charge.postedOn))}
									</TableCell>
									<TableCell className="text-end tabular-nums">
										{number.format(charge.quantity)}
									</TableCell>
									<TableCell className="text-end tabular-nums">
										{money.format(charge.unitPrice)}
									</TableCell>
									<TableCell className="text-end tabular-nums">
										{money.format(charge.amount)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
				<div className="grid @2xl/main:grid-cols-2 gap-6">
					<div className="grid content-start gap-2">
						<h3 className="font-medium font-sans text-sm">
							{t("folio.payments")}
						</h3>
						{payments.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								{t("folio.noPayments")}
							</p>
						) : (
							<ul className="grid gap-2 text-sm">
								{payments.map((payment) => (
									<li
										key={payment.id}
										className="flex items-baseline justify-between gap-3"
									>
										<span className="grid">
											<span>{t(`folio.paymentKinds.${payment.kind}`)}</span>
											<span className="text-muted-foreground text-xs tabular-nums">
												{`${date.format(new Date(payment.paidAt))} · ${t(`folio.methods.${payment.method}`)}`}
											</span>
										</span>
										<bdi dir="ltr" className="tabular-nums">
											{money.format(payment.amount)}
										</bdi>
									</li>
								))}
							</ul>
						)}
					</div>
					<dl className="grid content-start gap-2 rounded-surface bg-muted p-4 text-sm">
						<div className="flex items-baseline justify-between gap-3">
							<dt className="text-muted-foreground">{t("folio.charges")}</dt>
							<dd className="tabular-nums">{money.format(chargesTotal)}</dd>
						</div>
						<div className="flex items-baseline justify-between gap-3">
							<dt className="text-muted-foreground">{t("folio.paid")}</dt>
							<dd className="tabular-nums">{money.format(reservation.paid)}</dd>
						</div>
						<div className="flex items-baseline justify-between gap-3 border-t pt-2">
							<dt className="font-medium">{t("folio.balance")}</dt>
							<dd className="font-numeric text-xl tabular-nums">
								{money.format(reservation.balance)}
							</dd>
						</div>
					</dl>
				</div>
			</CardContent>
		</Card>
	);
}
