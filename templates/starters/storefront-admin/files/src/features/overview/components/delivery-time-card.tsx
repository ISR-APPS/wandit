// The "Delivery time" card of the home: the mean days from order to door, the parcels per count of days,
// and a box with the next order that the team must ship. OverviewPage renders it at the end of the third band.
// The box reads the order list: the order to ship with the earliest ship-by time.
import { CaretRightIcon, TruckIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	itemsSummaryOf,
	type Order,
	orderNumberOf,
	ShelfStageBadge,
} from "~/features/orders";
import { fillMessage, formatRelativeTime, shelfStageOf } from "~/features/shop";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { DeliveryTimes } from "../lib/summary";

/** Bar fill per bucket, from the fastest (1 day) to the slowest (5 days and more). The row text names each one. */
const BUCKET_FILL = [
	"bg-success",
	"bg-success/60",
	"bg-warning",
	"bg-destructive/60",
	"bg-destructive",
];

type DeliveryTimeCardProps = {
	/** The delivery times of the parcels that arrived in the period. */
	delivery: DeliveryTimes;
	/** The order to ship with the earliest ship-by time, or null when no order waits. */
	nextOrder: Order | null;
	/** The length of the period, already written, for example "30 days". */
	periodText: string;
	className?: string;
};

/** The bars are each bucket's share of the parcels, so the five bars sum to the whole. */
export function DeliveryTimeCard({
	delivery,
	nextOrder,
	periodText,
	className,
}: DeliveryTimeCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const average = new Intl.NumberFormat(locale, {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});
	const now = Date.now();
	const nextStage = nextOrder ? shelfStageOf(nextOrder, now) : null;

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("overview.delivery.title")}</CardTitle>
				<CardDescription>
					{fillMessage(t("overview.delivery.description"), {
						count: number.format(delivery.deliveredCount),
						period: periodText,
					})}
				</CardDescription>
				<CardAction>
					<Button size="sm" variant="outline" asChild>
						<Link
							to="/app/orders"
							search={{ status: "delivered" }}
							aria-label={t("overview.delivery.viewAll")}
						>
							<span className="@md/main:inline hidden">
								{t("overview.delivery.viewAll")}
							</span>
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-6">
				<div className="grid @lg/main:grid-cols-3 gap-4">
					<div className="flex flex-col items-center justify-center gap-2">
						<span className="flex size-12 items-center justify-center rounded-full border bg-muted">
							<TruckIcon className="size-6" />
						</span>
						<p className="font-numeric text-3xl tabular-nums">
							{delivery.averageDays === null
								? "–"
								: average.format(delivery.averageDays)}
						</p>
						<p className="text-muted-foreground text-sm">
							{t("overview.delivery.averageCaption")}
						</p>
					</div>
					<ul className="@lg/main:col-span-2 grid content-center gap-3">
						{delivery.buckets.map((count, index) => {
							const share =
								delivery.deliveredCount === 0
									? 0
									: (count / delivery.deliveredCount) * 100;
							const label =
								index === delivery.buckets.length - 1
									? fillMessage(t("overview.delivery.daysOrMore"), {
											count: number.format(index + 1),
										})
									: fillMessage(
											t(
												index === 0
													? "overview.delivery.dayOne"
													: "overview.delivery.days",
											),
											{ count: number.format(index + 1) },
										);
							return (
								// Each bucket has a different day count, so its label is a unique key.
								<li key={label} className="flex items-center gap-2">
									<span className="w-20 shrink-0 font-medium text-sm">
										{label}
									</span>
									<div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
										<div
											className={cn(
												"h-full rounded-full",
												BUCKET_FILL[index] ?? "bg-muted-foreground",
											)}
											style={{ width: `${share}%` }}
										/>
									</div>
									<span className="w-10 shrink-0 text-end text-muted-foreground text-sm tabular-nums">
										{number.format(count)}
									</span>
								</li>
							);
						})}
					</ul>
				</div>
				{nextOrder ? (
					<div className="rounded-md border bg-muted p-4">
						<div className="mb-2 flex flex-wrap items-start justify-between gap-2">
							<div className="grid gap-1">
								<div className="flex items-center gap-1">
									{nextStage ? <ShelfStageBadge stage={nextStage} /> : null}
								</div>
								<Link
									to="/app/orders/$orderId"
									params={{ orderId: nextOrder.id }}
									className="font-medium hover:underline"
								>
									{fillMessage(t("overview.delivery.nextTitle"), {
										number: orderNumberOf(nextOrder.id),
									})}
								</Link>
							</div>
							<span className="text-muted-foreground text-xs">
								{fillMessage(t("overview.delivery.placed"), {
									relative: formatRelativeTime(nextOrder.placedAt, now, locale),
								})}
							</span>
						</div>
						<p className="mb-3 text-muted-foreground text-sm">
							{itemsSummaryOf(nextOrder, t("orders.itemsMore"), number)}
						</p>
						<div className="flex items-center gap-2 text-xs">
							<span className="font-medium" dir="auto">
								{nextOrder.customerName}
							</span>
							<Badge variant="info">
								{t(`orders.shipping.${nextOrder.shippingMethod}`)}
							</Badge>
						</div>
					</div>
				) : (
					<p className="rounded-md border bg-muted p-4 text-muted-foreground text-sm">
						{t("overview.delivery.noneWaiting")}
					</p>
				)}
			</CardContent>
		</Card>
	);
}
