// The payments card of the member page: the next payment, then the past ones, in a small table.
// MemberDetailPage renders it under the timeline. It follows the transaction history card of the kit profile page.
// The days come from the join day and the plan billing; the sample keeps no payment table.
import { moneyFormat } from "~/features/gym";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import type { PaymentRow } from "../lib/member-rows";

type MemberPaymentsCardProps = {
	/** The next payment ("due") first, then the past ones, newest first. */
	payments: PaymentRow[];
};

/** Each state shows its word in a badge, so the color is never the only mark. */
export function MemberPaymentsCard({ payments }: MemberPaymentsCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("members.paymentsTitle")}</CardTitle>
			</CardHeader>
			<CardContent>
				{payments.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("members.noPayments")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("members.state")}</TableHead>
								<TableHead>{t("members.date")}</TableHead>
								<TableHead className="text-end">
									{t("members.amount")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{payments.map((payment) => (
								<TableRow key={payment.id}>
									<TableCell>
										<Badge
											variant={payment.state === "due" ? "warning" : "success"}
										>
											{t(`members.paymentStates.${payment.state}`)}
										</Badge>
									</TableCell>
									<TableCell className="tabular-nums">
										{date.format(payment.day)}
									</TableCell>
									<TableCell className="text-end tabular-nums">
										{money.format(payment.amount)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
