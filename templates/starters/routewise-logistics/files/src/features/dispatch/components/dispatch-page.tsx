// The home behind login: the next shipment to handle beside the queue of open shipments, then the deliveries of the period.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// It follows the home "focus-queue" of the app-dashboard skill: the counts live in the header and in the tabs.
import { useSuspenseQuery } from "@tanstack/react-query";
import { PageHeader } from "~/features/app-shell";
import {
	fillMessage,
	LoadError,
	type PeriodDays,
	pluralForm,
} from "~/features/logistics";
import {
	deliveryFiguresQueryOptions,
	lateByReasonQueryOptions,
	shipmentsQueryOptions,
} from "~/features/shipments";
import { useT } from "~/shared/i18n";
import { Skeleton } from "~/shared/ui/skeleton";
import { openQueue } from "../lib/queue";
import { DeliveriesTrendCard } from "./deliveries-trend-card";
import { LateReasonsCard } from "./late-reasons-card";
import { NextUpCard } from "./next-up-card";
import { QueueCard } from "./queue-card";

/** The period of the first load, in days. The loader prefetches the queries of this period. */
export const DISPATCH_DEFAULT_DAYS: PeriodDays = 30;

/** The home. The open rows come from the list query; the browser counts, sorts, and filters them. */
export function DispatchPage() {
	const { t, locale } = useT();
	const { data: shipments } = useSuspenseQuery(
		shipmentsQueryOptions(DISPATCH_DEFAULT_DAYS),
	);
	const { data: lateByReason } = useSuspenseQuery(
		lateByReasonQueryOptions(DISPATCH_DEFAULT_DAYS),
	);
	const { data: figures } = useSuspenseQuery(
		deliveryFiguresQueryOptions(DISPATCH_DEFAULT_DAYS),
	);
	const deliveredCount =
		figures.find((figure) => figure.id === "delivered")?.value ?? 0;
	const number = new Intl.NumberFormat(locale);
	const queue = openQueue(shipments);
	const lateCount = queue.filter((row) => row.lateDays > 0).length;

	return (
		<div className="grid @3xl/main:gap-6 gap-4">
			<PageHeader
				title={t("dispatch.title")}
				description={fillMessage(
					t(`dispatch.summary.${pluralForm(queue.length, locale)}`),
					{
						open: number.format(queue.length),
						late: number.format(lateCount),
					},
				)}
			/>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @3xl/main:gap-6 gap-4">
				<NextUpCard shipment={queue[0]} />
				<div className="@4xl/main:col-span-2 min-w-0">
					<QueueCard shipments={queue} />
				</div>
			</div>
			<div className="grid @4xl/main:grid-cols-2 grid-cols-1 @3xl/main:gap-6 gap-4">
				<DeliveriesTrendCard defaultDays={DISPATCH_DEFAULT_DAYS} />
				<LateReasonsCard
					slices={lateByReason}
					days={DISPATCH_DEFAULT_DAYS}
					deliveredCount={deliveredCount}
				/>
			</div>
		</div>
	);
}

/** Placeholder while the home loader runs: the same spans and heights as the page. The route sets it as pendingComponent. */
export function DispatchPageSkeleton() {
	return (
		<div className="grid @3xl/main:gap-6 gap-4">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-48" />
			</div>
			{/* The heights match the real panels at 1440 px: the queue of 10 rows, then the chart panel. */}
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @3xl/main:gap-6 gap-4">
				<Skeleton className="h-[44rem]" />
				<Skeleton className="@4xl/main:col-span-2 h-[44rem]" />
			</div>
			<div className="grid @4xl/main:grid-cols-2 grid-cols-1 @3xl/main:gap-6 gap-4">
				<Skeleton className="h-[29rem]" />
				<Skeleton className="h-[29rem]" />
			</div>
		</div>
	);
}

/** Error state of the home when its loader fails. Try again runs the loader again. */
export function DispatchPageError() {
	const { t } = useT();
	return <LoadError message={t("dispatch.loadError")} />;
}
