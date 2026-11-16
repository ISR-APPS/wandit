// The day report: the 4 figures of the day, sales by hour, payments, categories, best sellers, servers, and tax.
// The /app/report route renders it after its loader. The route also uses the skeleton and the error below.
// Every panel adds up to the same gross sales, so a manager can close the till against it.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { PageHeader } from "~/features/app-shell";
import { KpiFigure } from "~/features/floor";
import { buildMenuRows } from "~/features/menu";
import {
	fillMessage,
	formatClock,
	menuQueryOptions,
	ordersQueryOptions,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { dayReportQueryOptions } from "../api/day-report.queries";
import { BestSellersPanel } from "./best-sellers-panel";
import { CategoryPanel } from "./category-panel";
import { PaymentsPanel } from "./payments-panel";
import { ServersPanel } from "./servers-panel";
import { TaxPanel } from "./tax-panel";

// recharts is large. The chart loads in its own chunk, so the first page load of the app stays small.
const SalesByHourPanel = lazy(() =>
	import("./sales-by-hour-panel").then((module) => ({
		default: module.SalesByHourPanel,
	})),
);

/** The figures band opens the page. Three rows of panels follow, each 2 to 1 or 1 to 2. */
export function ReportPage() {
	const { t, locale } = useT();
	const { data: report, dataUpdatedAt } = useSuspenseQuery(
		dayReportQueryOptions(),
	);
	const { data: menu } = useSuspenseQuery(menuQueryOptions());
	const { data: orders } = useSuspenseQuery(ordersQueryOptions());
	const menuRows = buildMenuRows(menu, orders);

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("report.title")}
				description={
					report.openedAt
						? fillMessage(t("report.description"), {
								time: formatClock(report.openedAt, locale),
								updated: formatClock(
									new Date(dataUpdatedAt).toISOString(),
									locale,
								),
							})
						: undefined
				}
			/>
			<Card className="py-5">
				<CardContent className="grid @3xl/main:grid-cols-4 grid-cols-2 gap-x-6 gap-y-5 @3xl/main:divide-x @3xl/main:rtl:divide-x-reverse">
					{report.figures.map((item) => (
						<div key={item.id} className="@3xl/main:ps-6 @3xl/main:first:ps-0">
							<KpiFigure item={item} size="lg" />
						</div>
					))}
				</CardContent>
			</Card>
			<p className="-mt-3 text-muted-foreground text-xs">
				{t("report.comparedWith")}
			</p>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @3xl/main:gap-6 gap-4">
				<div className="@4xl/main:col-span-2">
					<Suspense fallback={<SalesByHourSkeleton />}>
						<SalesByHourPanel hours={report.hours} />
					</Suspense>
				</div>
				<PaymentsPanel
					rows={report.payments}
					grossCents={report.grossCents}
					tipsCents={report.tipsCents}
				/>
			</div>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @3xl/main:gap-6 gap-4">
				<CategoryPanel rows={report.categories} />
				<div className="@4xl/main:col-span-2">
					<BestSellersPanel rows={menuRows} />
				</div>
			</div>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @3xl/main:gap-6 gap-4">
				<div className="@4xl/main:col-span-2">
					<ServersPanel rows={report.servers} />
				</div>
				<TaxPanel rows={report.vat} voids={report.voids} />
			</div>
		</div>
	);
}

// The sales by hour panel in its final size, while its chart chunk loads.
function SalesByHourSkeleton() {
	return (
		<Card className="h-full">
			<CardHeader>
				<Skeleton className="h-5 w-32" />
				<Skeleton className="h-4 w-56" />
			</CardHeader>
			<CardContent>
				<Skeleton className="h-64 w-full" />
			</CardContent>
		</Card>
	);
}

// Placeholder figures of the skeleton. Fixed keys, because they never reorder.
const SKELETON_FIGURES = ["1", "2", "3", "4"];

/** Placeholder while the report loader runs: the header, the band, and the first row of panels. */
export function ReportPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-72 max-w-full" />
			</div>
			<Card className="py-5">
				<CardContent className="grid @3xl/main:grid-cols-4 grid-cols-2 gap-6">
					{SKELETON_FIGURES.map((key) => (
						<div key={key} className="grid gap-2">
							<Skeleton className="h-3 w-20" />
							<Skeleton className="h-8 w-28" />
							<Skeleton className="h-3 w-14" />
						</div>
					))}
				</CardContent>
			</Card>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @3xl/main:gap-6 gap-4">
				<div className="@4xl/main:col-span-2">
					<SalesByHourSkeleton />
				</div>
				<Card>
					<CardHeader>
						<Skeleton className="h-5 w-24" />
					</CardHeader>
					<CardContent className="grid gap-4">
						<Skeleton className="h-12 w-full" />
						<Skeleton className="h-12 w-full" />
						<Skeleton className="h-12 w-full" />
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

/** Error state of the report when its loader fails. Try again runs the loader again. */
export function ReportPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("report.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
