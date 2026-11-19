// The payment card of the reservation page: a bar of the paid share of the folio, and the balance.
// ReservationDetailPage renders it under the guest card. It follows the "complete your profile" card of the kit.
// A stay that did not happen shows one sentence instead of the bar.
import { fillMessage, moneyFormat } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { ReservationRow } from "../api/reservations.queries";

type PaymentCardProps = {
	/** The reservation. Its `total`, `paid`, and `balance` are in whole units of the hotel currency. */
	reservation: ReservationRow;
};

/** The percent sits at the end of the bar, as in the kit. */
export function PaymentCard({ reservation }: PaymentCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const didNotHappen =
		reservation.status === "cancelled" || reservation.status === "no_show";
	// A folio of 0 has nothing to pay, so it counts as paid.
	const share =
		reservation.total === 0
			? 1
			: Math.min(1, Math.max(0, reservation.paid / reservation.total));

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("reservations.payment")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-3">
				{didNotHappen ? (
					<p className="text-muted-foreground text-sm">
						{t(
							reservation.status === "cancelled"
								? "reservations.cancelledNote"
								: "reservations.noShowNote",
						)}
					</p>
				) : (
					<>
						<div className="flex items-center gap-4">
							<Progress
								value={share * 100}
								className="h-2 flex-1"
								aria-label={t("reservations.payment")}
							/>
							<span className="text-muted-foreground text-sm tabular-nums">
								{percent.format(share)}
							</span>
						</div>
						<p className="text-muted-foreground text-sm">
							{fillMessage(t("reservations.paidOf"), {
								paid: money.format(reservation.paid),
								total: money.format(reservation.total),
								balance: money.format(reservation.balance),
							})}
						</p>
					</>
				)}
			</CardContent>
		</Card>
	);
}
