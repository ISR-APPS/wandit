// The detail page of one payee: the bank details, every payment, and the totals per month.
// The /app/payees/$payeeId route renders it after its loader. An unknown id shows a not-found block.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	accountOf,
	addDays,
	dayFormat,
	dayToDate,
	fillMessage,
	relativeDayLabel,
	todayIsoDay,
} from "~/features/bank";
import { useTransactionColumns } from "~/features/transactions";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DataTable } from "~/shared/ui/data-table";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { payeeDetailQueryOptions } from "../api/payees.queries";
import { PayeeMonthsCard } from "./payee-months-card";

type PayeeDetailPageProps = {
	/** The `$payeeId` param of the URL. An unknown id shows the not-found block. */
	payeeId: string;
};

/**
 * From the 4xl container width: the month totals in 2/3 beside the bank details in 1/3, both of one height.
 * The long payments table takes the full width under them.
 */
export function PayeeDetailPage({ payeeId }: PayeeDetailPageProps) {
	const { t, locale } = useT();
	const { data: detail } = useSuspenseQuery(payeeDetailQueryOptions(payeeId));
	const { columns, searchText } = useTransactionColumns(
		detail?.payments ?? [],
		"payee",
	);

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start max-md:h-11"
		>
			<Link to="/app/payees">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("payees.title")}
			</Link>
		</Button>
	);
	if (!detail) {
		return (
			<div className="grid gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">{t("payees.notFound")}</p>
			</div>
		);
	}

	const { payee, lastPaidDay } = detail.summary;
	const today = todayIsoDay();
	const longDay = dayFormat(locale, "long");
	// The payments table has no account column, so the method names the account of the newest payment.
	const paidFrom = detail.payments[0]
		? accountOf(detail.payments[0].accountId)
		: undefined;
	const method = t(`methods.${payee.method}`);
	const facts = [
		{ id: "bank", label: t("payees.bank"), value: payee.bankName },
		{
			id: "account",
			label: t("payees.accountNumber"),
			value: `•••• ${payee.accountEnding}`,
		},
		{
			id: "routing",
			label: t("payees.routingNumber"),
			value: `•••• ${payee.routingEnding}`,
		},
		{
			id: "method",
			label: t("payees.method"),
			value: paidFrom
				? fillMessage(t("payees.methodFrom"), {
						method,
						account: `${t(`accounts.${paidFrom.id}`)} ••${paidFrom.numberEnding}`,
					})
				: method,
		},
		{
			id: "added",
			label: t("payees.added"),
			value: longDay.format(dayToDate(addDays(today, -payee.addedDaysAgo))),
		},
		{
			id: "lastPaid",
			label: t("payees.lastPaid"),
			value: lastPaidDay
				? `${longDay.format(dayToDate(lastPaidDay))} · ${relativeDayLabel(lastPaidDay, today, locale)}`
				: t("payees.never"),
		},
	];

	return (
		<div className="grid gap-6">
			{backLink}
			<PageHeader
				title={payee.name}
				description={
					<span className="flex flex-wrap items-center gap-2">
						<Badge variant="secondary">
							{t(`payees.categories.${payee.category}`)}
						</Badge>
						<span>{payee.note}</span>
					</span>
				}
			/>
			<div className="grid @4xl/main:grid-cols-3 gap-6">
				{/* From 56rem the month totals take 2/3 and the bank details move to a 1/3 rail on the end side. */}
				<Card className="@4xl/main:col-start-3 @4xl/main:row-start-1">
					<CardHeader>
						<CardTitle>{t("payees.detailsTitle")}</CardTitle>
					</CardHeader>
					<CardContent>
						<dl className="grid @4xl/main:grid-cols-1 @xl/main:grid-cols-3 grid-cols-2 gap-x-6 gap-y-4 text-sm">
							{facts.map((fact) => (
								// content-start: a value that wraps makes its row taller, and the short value beside it stays under its label.
								<div key={fact.id} className="grid content-start gap-1">
									<dt className="text-muted-foreground">{fact.label}</dt>
									<dd className="tabular-nums">{fact.value}</dd>
								</div>
							))}
						</dl>
					</CardContent>
				</Card>
				{/* A grid wrapper stretches the month card to the height of the bank details. */}
				<div className="@4xl/main:col-span-2 @4xl/main:col-start-1 @4xl/main:row-start-1 grid min-w-0">
					<PayeeMonthsCard detail={detail} />
				</div>
				<Card className="@4xl/main:col-span-3">
					<CardHeader>
						<CardTitle>{t("payees.paymentsTitle")}</CardTitle>
						<CardDescription>{t("payees.paymentsDescription")}</CardDescription>
					</CardHeader>
					<CardContent className="max-md:px-3">
						{detail.payments.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								{t("payees.noPayments")}
							</p>
						) : (
							<DataTable
								rows={detail.payments}
								columns={columns}
								searchText={searchText}
								noResults={t("transactions.noResults")}
							/>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

/** Placeholder while the payee loader runs. The route sets it as pendingComponent. */
export function PayeeDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-28" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-64 max-w-full" />
				<Skeleton className="h-5 w-48" />
			</div>
			<div className="grid @4xl/main:grid-cols-3 items-start gap-6">
				<Skeleton className="@4xl/main:col-span-2 h-96" />
				<Skeleton className="h-80" />
			</div>
		</div>
	);
}
