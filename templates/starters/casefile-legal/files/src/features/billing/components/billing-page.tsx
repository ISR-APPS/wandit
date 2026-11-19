// The billing page, built on the kit finance KPI row and the kit transaction list:
// the period and the export in the header, four KPI tiles, then the tabs "Recent" and "Upcoming".
// The /app/billing route renders it after its loader. The route also uses the skeleton and the error below.
// The open invoice lives in the URL (?invoice=), so the matter and client pages link to one invoice.
import {
	ArrowDownLeftIcon,
	ClockIcon,
	DownloadSimpleIcon,
	HourglassIcon,
	InvoiceIcon,
} from "@phosphor-icons/react";
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	ChangeLine,
	CURRENCY,
	calendarDaysUntil,
	dayCountFormat,
	downloadCsv,
	fillMessage,
	moneyFormat,
	type PeriodDays,
	PeriodSelect,
	toCsv,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	BILLING_DEFAULT_DAYS,
	billingSummaryQueryOptions,
	openInvoicesQueryOptions,
	recentLinesQueryOptions,
} from "../api/billing.queries";
import type {
	BillingSummary,
	InvoiceListItem,
	LedgerLine,
} from "../lib/billing";
import { BillingKpiCard } from "./billing-kpi-card";
import { InvoiceDialog } from "./invoice-dialog";
import { LedgerList, type LedgerRow } from "./ledger-list";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const InvoicedSpark = lazy(() =>
	import("./invoiced-spark").then((module) => ({
		default: module.InvoicedSpark,
	})),
);

/** The two tabs of the list. "upcoming" holds every open invoice, the overdue ones first. */
type BillingTab = "recent" | "upcoming";

/** The page holds the period and the tab. The KPI row and the "Recent" tab read the chosen period. */
export function BillingPage() {
	const { t, locale } = useT();
	const search = useSearch({ from: "/app/billing" });
	const navigate = useNavigate({ from: "/app/billing" });
	const [days, setDays] = useState<PeriodDays>(BILLING_DEFAULT_DAYS);
	const [tab, setTab] = useState<BillingTab>("recent");
	const { data: openInvoices } = useSuspenseQuery(openInvoicesQueryOptions());
	// The loader fills the default period. Another period loads here and keeps the old numbers until it is ready.
	const summary = useQuery({
		...billingSummaryQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const recent = useQuery({
		...recentLinesQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const now = Date.now();
	const money = moneyFormat(locale);
	const signedMoney = new Intl.NumberFormat(locale, {
		style: "currency",
		currency: CURRENCY,
		maximumFractionDigits: 0,
		signDisplay: "exceptZero",
	});
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const dayCount = dayCountFormat(locale);
	const today = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});

	const recentRows: LedgerRow[] = (recent.data ?? []).map(
		(line: LedgerLine) => ({
			id: line.id,
			date: date.format(new Date(line.at)),
			title: fillMessage(
				t(
					line.kind === "payment" ? "billing.paymentFrom" : "billing.invoiceTo",
				),
				{ number: line.invoice.number, client: line.invoice.clientName },
			),
			detail: `${line.invoice.matterName} · ${t(`invoiceStatus.${line.invoice.status}`)}`,
			amount:
				line.kind === "payment"
					? signedMoney.format(line.amount)
					: money.format(line.amount),
			tone: line.kind === "payment" ? "in" : "plain",
			invoiceId: line.invoice.id,
		}),
	);
	const upcomingRows: LedgerRow[] = openInvoices.map(
		(invoice: InvoiceListItem) => {
			const daysLeft = calendarDaysUntil(invoice.dueAt, now);
			return {
				id: invoice.id,
				date: date.format(new Date(invoice.dueAt)),
				title: `${invoice.number} · ${invoice.clientName}`,
				detail:
					daysLeft < 0
						? fillMessage(t("billing.overdueBy"), {
								days: dayCount.format(-daysLeft),
							})
						: fillMessage(t("billing.dueIn"), {
								days: dayCount.format(daysLeft),
							}),
				amount: money.format(invoice.amount - invoice.paidAmount),
				tone: daysLeft < 0 ? "late" : "plain",
				invoiceId: invoice.id,
			};
		},
	);
	const shownRows = tab === "recent" ? recentRows : upcomingRows;

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("billing.title")}
				description={fillMessage(t("period.description"), {
					period: dayCount.format(days),
					today: today.format(now),
				})}
				actions={
					<>
						<PeriodSelect days={days} onDaysChange={setDays} />
						<Button
							type="button"
							size="icon"
							aria-label={t("billing.exportList")}
							onClick={() =>
								downloadCsv(
									tab === "recent"
										? "billing-recent.csv"
										: "billing-upcoming.csv",
									toCsv(shownRows, [
										{ header: t("billing.date"), value: (row) => row.date },
										{
											header: t("billing.description"),
											value: (row) => row.title,
										},
										{ header: t("billing.detail"), value: (row) => row.detail },
										{ header: t("billing.amount"), value: (row) => row.amount },
									]),
								)
							}
						>
							<DownloadSimpleIcon />
						</Button>
					</>
				}
			/>
			{summary.isError ? (
				<div className="grid justify-items-start gap-3 rounded-surface border p-6">
					<p className="text-sm" role="alert">
						{t("billing.summaryError")}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => summary.refetch()}
					>
						{t("common.retry")}
					</Button>
				</div>
			) : summary.data === undefined ? (
				<KpiSkeleton />
			) : (
				<KpiRow
					summary={summary.data}
					period={dayCount.format(days)}
					onShowUpcoming={() => setTab("upcoming")}
				/>
			)}
			<Tabs
				value={tab}
				onValueChange={(value) =>
					setTab(value === "upcoming" ? "upcoming" : "recent")
				}
				className="gap-4"
			>
				<TabsList>
					<TabsTrigger value="recent">{t("billing.recent")}</TabsTrigger>
					<TabsTrigger value="upcoming">{t("billing.upcoming")}</TabsTrigger>
				</TabsList>
				<TabsContent value="recent">
					{recent.isError ? (
						<p className="text-muted-foreground text-sm" role="alert">
							{t("billing.listError")}
						</p>
					) : recent.data === undefined ? (
						<Skeleton className="h-96" />
					) : (
						// The key starts the "Show more" count again for a new period.
						<LedgerList
							key={days}
							rows={recentRows}
							empty={t("billing.noRecent")}
						/>
					)}
				</TabsContent>
				<TabsContent value="upcoming">
					<LedgerList rows={upcomingRows} empty={t("billing.noUpcoming")} />
				</TabsContent>
			</Tabs>
			<InvoiceDialog
				invoiceId={search.invoice ?? null}
				onClose={() => navigate({ search: { invoice: undefined } })}
			/>
		</div>
	);
}

type KpiRowProps = {
	summary: BillingSummary;
	/** The period in words, for example "30 days". */
	period: string;
	/** Opens the "Upcoming" tab, where the overdue invoices come first. */
	onShowUpcoming: () => void;
};

// The four KPI tiles: collected with two buttons, billed, days to pay, and outstanding with mini bars.
function KpiRow({ summary, period, onShowUpcoming }: KpiRowProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const context = fillMessage(t("billing.vsPeriod"), { period });
	return (
		<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
			<BillingKpiCard
				label={t("billing.collected")}
				icon={ArrowDownLeftIcon}
				value={money.format(summary.collected.value)}
			>
				<div className="grid gap-3">
					<div className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-sm">
						<ChangeLine change={summary.collected.change} goodWhen="up" />
						{summary.collected.change === null ? null : <span>{context}</span>}
					</div>
					<div className="flex flex-wrap gap-2">
						<Button type="button" size="sm" onClick={onShowUpcoming}>
							{t("billing.showOpen")}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() =>
								downloadCsv(
									"billing-summary.csv",
									toCsv(
										[
											{
												id: "collected",
												label: t("billing.collected"),
												value: summary.collected.value,
											},
											{
												id: "billed",
												label: t("billing.billed"),
												value: summary.billed.value,
											},
											{
												id: "outstanding",
												label: t("billing.outstanding"),
												value: summary.outstanding.value,
											},
										],
										[
											{
												header: t("billing.figure"),
												value: (row) => row.label,
											},
											{
												header: `${t("billing.amount")} (${CURRENCY})`,
												value: (row) => String(row.value),
											},
										],
									),
								)
							}
						>
							{t("common.export")}
						</Button>
					</div>
				</div>
			</BillingKpiCard>
			<BillingKpiCard
				label={t("billing.billed")}
				icon={InvoiceIcon}
				value={money.format(summary.billed.value)}
			>
				<div className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-sm">
					<ChangeLine change={summary.billed.change} goodWhen="up" />
					{summary.billed.change === null ? null : <span>{context}</span>}
				</div>
			</BillingKpiCard>
			<BillingKpiCard
				label={t("billing.daysToPay")}
				icon={HourglassIcon}
				value={
					summary.daysToPay.value === null
						? "–"
						: dayCountFormat(locale).format(summary.daysToPay.value)
				}
			>
				<div className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-sm">
					{/* Fewer days to pay means clients settle sooner. */}
					<ChangeLine change={summary.daysToPay.change} goodWhen="down" />
					{summary.daysToPay.change === null ? null : <span>{context}</span>}
				</div>
			</BillingKpiCard>
			<BillingKpiCard
				label={t("billing.outstanding")}
				icon={ClockIcon}
				value={money.format(summary.outstanding.value)}
				badge={
					summary.outstanding.overdueCount > 0 ? (
						<Badge variant="destructive">
							{fillMessage(t("billing.overdueCount"), {
								count: number.format(summary.outstanding.overdueCount),
							})}
						</Badge>
					) : null
				}
			>
				<div className="grid gap-2">
					<p className="text-muted-foreground text-sm">
						{fillMessage(t("billing.openInvoices"), {
							count: number.format(summary.outstanding.openCount),
						})}
					</p>
					{summary.invoicedPerDay.length < 2 ? null : (
						<Suspense fallback={<Skeleton className="h-12" />}>
							<InvoicedSpark points={summary.invoicedPerDay} />
						</Suspense>
					)}
				</div>
			</BillingKpiCard>
		</div>
	);
}

// Placeholder keys of the KPI row. Fixed keys, because the cards never reorder.
const SKELETON_KPIS = ["1", "2", "3", "4"];

// The KPI row while the summary loads.
function KpiSkeleton() {
	return (
		<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
			{SKELETON_KPIS.map((key) => (
				<Skeleton key={key} className="h-48" />
			))}
		</div>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function BillingPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-32" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<Skeleton className="h-9 w-48" />
			</div>
			<KpiSkeleton />
			<Skeleton className="h-9 w-48" />
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
