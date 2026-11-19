// The page of one payee, in the kit profile anatomy: the payee card, its share of payee payments, and its labels
// in the start column; the latest payments, the payment table, and the other payees of its group in the end column.
// The /app/payees/$payeeId route renders it after its loader. It reads the payee detail and the payee list.
import {
	ArrowLeftIcon,
	ArrowsLeftRightIcon,
	BankIcon,
	CalendarBlankIcon,
	CopyIcon,
	HashIcon,
	ReceiptIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	accountOf,
	addDays,
	centsToUnits,
	copyToClipboard,
	DetailProfileCard,
	DetailProgressCard,
	DetailTagsCard,
	DetailTimelineCard,
	dayFormat,
	dayToDate,
	EntryHistoryCard,
	fillMessage,
	initialsOf,
	moneyFormat,
	RelatedListCard,
	todayIsoDay,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import {
	payeeDetailQueryOptions,
	payeesQueryOptions,
} from "../api/payees.queries";
import { PayeeStatusBadge } from "./payee-status-badge";

// The timeline shows the newest payments, as the 3 events of the kit activity card.
const TIMELINE_PAYMENTS = 3;

// The payment table shows this many rows, as the history table of the kit profile page.
const TABLE_PAYMENTS = 6;

type PayeeDetailPageProps = {
	/** The id of the URL. It can be any text; an unknown id shows the not-found state. */
	payeeId: string;
};

/** Three columns from the @4xl width: the start column is 1/3, the end column 2/3. */
export function PayeeDetailPage({ payeeId }: PayeeDetailPageProps) {
	const { t, locale } = useT();
	const { data: detail } = useSuspenseQuery(payeeDetailQueryOptions(payeeId));
	const { data: summaries } = useSuspenseQuery(payeesQueryOptions());
	const money = moneyFormat(locale, 0);
	// One entry shows its cents, as the table beside it does.
	const exactMoney = moneyFormat(locale, 2);
	const longDay = dayFormat(locale, "long");
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const backLink = (
		<Button variant="ghost" size="sm" className="-ms-3 w-fit" asChild>
			<Link to="/app/payees">
				<ArrowLeftIcon className="rtl:rotate-180" />
				{t("payees.title")}
			</Link>
		</Button>
	);
	if (!detail) {
		return (
			<div className="grid gap-4">
				{backLink}
				<Card>
					<CardContent>
						<p role="alert">{t("payees.notFound")}</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	const { summary, payments } = detail;
	const { payee } = summary;
	const operating = accountOf("operating");
	const allPaidCents = summaries.reduce((sum, item) => sum + item.paidCents, 0);
	const share = allPaidCents === 0 ? 0 : summary.paidCents / allPaidCents;
	const averageCents =
		summary.paymentCount === 0 ? 0 : summary.paidCents / summary.paymentCount;
	const groupMates = summaries.filter(
		(item) => item.id !== payee.id && item.payee.category === payee.category,
	);

	return (
		<div className="grid gap-4">
			<div className="grid gap-2">
				{backLink}
				<PageHeader
					title={payee.name}
					description={payee.note}
					actions={
						<Button
							type="button"
							onClick={() =>
								copyToClipboard(payee.accountEnding, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							<CopyIcon />
							{t("payees.copyAccount")}
						</Button>
					}
				/>
			</div>
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<div className="grid content-start gap-4">
					<DetailProfileCard
						initials={initialsOf(payee.name)}
						name={payee.name}
						badge={<PayeeStatusBadge status={summary.status} />}
						subtitle={t(`payees.categories.${payee.category}`)}
						stats={[
							{
								label: t("payees.paidShort"),
								value: money.format(centsToUnits(summary.paidCents)),
							},
							{
								label: t("payees.payments"),
								value: new Intl.NumberFormat(locale).format(
									summary.paymentCount,
								),
							},
							{
								label: t("payees.averageShort"),
								value: money.format(centsToUnits(averageCents)),
							},
						]}
						facts={[
							{
								id: "bank",
								icon: BankIcon,
								label: t("payees.bank"),
								content: payee.bankName,
							},
							{
								id: "account",
								icon: HashIcon,
								label: t("payees.accountNumber"),
								content: fillMessage(t("payees.accountLine"), {
									ending: payee.accountEnding,
								}),
							},
							{
								id: "routing",
								icon: HashIcon,
								label: t("payees.routingNumber"),
								content: fillMessage(t("payees.routingLine"), {
									ending: payee.routingEnding,
								}),
							},
							{
								id: "method",
								icon: ArrowsLeftRightIcon,
								label: t("payees.method"),
								content: fillMessage(t("payees.methodFrom"), {
									method: t(`methods.${payee.method}`),
									account: `${t("accounts.operating")} ••${operating.numberEnding}`,
								}),
							},
							{
								id: "added",
								icon: CalendarBlankIcon,
								label: t("payees.added"),
								content: fillMessage(t("payees.addedOn"), {
									day: longDay.format(
										dayToDate(addDays(todayIsoDay(), -payee.addedDaysAgo)),
									),
								}),
							},
						]}
					/>
					<DetailProgressCard
						title={t("payees.shareTitle")}
						description={fillMessage(t("payees.shareDescription"), {
							paid: money.format(centsToUnits(summary.paidCents)),
							all: money.format(centsToUnits(allPaidCents)),
						})}
						percent={share * 100}
						valueLabel={percent.format(share)}
					/>
					<DetailTagsCard
						title={t("payees.labelsTitle")}
						tags={[
							{
								id: "category",
								label: t(`payees.categories.${payee.category}`),
							},
							{ id: "method", label: t(`methods.${payee.method}`) },
							{ id: "bank", label: payee.bankName },
						]}
					/>
				</div>
				<div className="@4xl/main:col-span-2 grid content-start gap-4">
					<DetailTimelineCard
						title={t("payees.latestTitle")}
						events={payments.slice(0, TIMELINE_PAYMENTS).map((row, index) => ({
							id: row.id,
							icon: ReceiptIcon,
							title: row.memo,
							badge:
								index === 0 ? (
									<Badge variant="outline">
										{t("transactionDetail.latest")}
									</Badge>
								) : undefined,
							day: row.day,
							dayLabel: longDay.format(dayToDate(row.day)),
							text: fillMessage(t("payees.paymentLine"), {
								amount: exactMoney.format(
									centsToUnits(Math.abs(row.amountCents)),
								),
								method: t(`methods.${row.method}`),
								status: t(`statuses.${row.status}`),
							}),
							action:
								index === 0 ? (
									<Button variant="outline" size="sm" asChild>
										<Link
											to="/app/transactions/$transactionId"
											params={{ transactionId: row.id }}
										>
											{t("payees.openPayment")}
										</Link>
									</Button>
								) : undefined,
						}))}
						emptyText={t("payees.noPayments")}
					/>
					<div className="grid @2xl/main:grid-cols-2 gap-4">
						<EntryHistoryCard
							title={t("payees.paymentsTitle")}
							description={t("payees.paymentsDescription")}
							rows={payments.slice(0, TABLE_PAYMENTS)}
							labelOf={(row) => row.memo}
							emptyText={t("payees.noPayments")}
						/>
						<RelatedListCard
							title={fillMessage(t("payees.groupTitle"), {
								group: t(`payees.tabs.${payee.category}`),
							})}
							items={groupMates.map((item) => ({
								id: item.id,
								initials: initialsOf(item.payee.name),
								name: item.payee.name,
								detail: `${t(`payees.statuses.${item.status}`)} · ${money.format(centsToUnits(item.paidCents))}`,
								action: (
									<Button variant="outline" size="sm" asChild>
										<Link
											to="/app/payees/$payeeId"
											params={{ payeeId: item.id }}
										>
											{t("entries.openShort")}
										</Link>
									</Button>
								),
							}))}
							emptyText={t("payees.noGroupMates")}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
