// The billing page: the totals in the header, the hours trend and the hours by area, then the invoice table.
// The /app/billing route renders it after its loader. The route also uses the skeleton and the error below.
// The open invoice lives in the URL (?invoice=), so the matter and client pages link to one invoice.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { fillMessage, moneyFormat, type PeriodDays } from "~/features/practice";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	billingTotalsQueryOptions,
	hoursByAreaQueryOptions,
} from "../api/billing.queries";
import { BILLING_DAYS } from "../lib/billing";
import { HoursBreakdownCard } from "./hours-breakdown-card";
import { HoursTrendCard } from "./hours-trend-card";
import { InvoiceDialog } from "./invoice-dialog";
import { InvoicesCard } from "./invoices-card";

/** The page holds the period of the trend. The first load shows BILLING_DAYS days. */
export function BillingPage() {
	const { t, locale } = useT();
	const search = useSearch({ from: "/app/billing" });
	const navigate = useNavigate({ from: "/app/billing" });
	const [days, setDays] = useState<PeriodDays>(BILLING_DAYS);
	const { data: totals } = useSuspenseQuery(billingTotalsQueryOptions());
	const { data: byArea } = useSuspenseQuery(
		hoursByAreaQueryOptions(BILLING_DAYS),
	);
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("billing.title")}
				description={
					<span className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
						<span>
							{fillMessage(t("billing.outstanding"), {
								amount: money.format(totals.outstanding),
							})}
						</span>
						{totals.overdueCount > 0 ? (
							<span className="font-medium text-destructive">
								{fillMessage(t("billing.overdue"), {
									amount: money.format(totals.overdue),
									count: number.format(totals.overdueCount),
								})}
							</span>
						) : null}
						<span>
							{fillMessage(t("billing.collected"), {
								amount: money.format(totals.collected),
							})}
						</span>
					</span>
				}
			/>
			<div className="grid @4xl/main:grid-cols-3 items-stretch gap-6">
				<div className="@4xl/main:col-span-2 min-w-0">
					<HoursTrendCard days={days} onDaysChange={setDays} />
				</div>
				<HoursBreakdownCard
					slices={byArea.map((slice) => ({
						label: t(`areas.${slice.label}`),
						value: slice.value,
					}))}
				/>
			</div>
			<InvoicesCard />
			<InvoiceDialog
				invoiceId={search.invoice ?? null}
				onClose={() => navigate({ search: { invoice: undefined } })}
			/>
		</div>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function BillingPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-4 w-96 max-w-full" />
			</div>
			<div className="grid @4xl/main:grid-cols-3 gap-6">
				<Skeleton className="@4xl/main:col-span-2 h-96" />
				<Skeleton className="h-96" />
			</div>
			<Skeleton className="h-96" />
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
export function BillingPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("billing.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
