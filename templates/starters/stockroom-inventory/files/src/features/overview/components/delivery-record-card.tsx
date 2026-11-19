// The delivery record card of the home: the on-time rate of the orders delivered in the period,
// the count per delay group as bars, and the newest order received in full in a box.
// It takes the place of the kit "customer reviews" card. OverviewPage renders it.
import { TruckIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	dayCountFormat,
	fillMessage,
	formatRelativeDay,
	pluralForm,
} from "~/features/stock";
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
import { CaretRightIcon } from "~/shared/ui/icons";
import type { DelayBucket, OverviewSummary } from "../api/overview.queries";

// Green for early and on time, amber for a short delay, red for a long one. The label always names the group.
const BAR_TONE = {
	early: "bg-success/60",
	onTime: "bg-success",
	late1: "bg-warning/60",
	late2to3: "bg-warning",
	late4plus: "bg-destructive",
} satisfies Record<DelayBucket, string>;

// The rate shows as a row of 5 trucks, one per 20 % of on-time deliveries.
const TRUCK_POSITIONS = [1, 2, 3, 4, 5];

type DeliveryRecordCardProps = {
	deliveries: OverviewSummary["deliveries"];
	/** The current time in ms, for the relative day of the newest delivery. */
	now: number;
	/** The grid span classes of the page. */
	className?: string;
};

/** The bars compare each group with the largest group, so the longest bar fills the track. */
export function DeliveryRecordCard({
	deliveries,
	now,
	className,
}: DeliveryRecordCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const dayCount = dayCountFormat(locale);
	const largest = Math.max(
		1,
		...deliveries.buckets.map((entry) => entry.count),
	);
	const filledTrucks = Math.round(
		(deliveries.onTimeRate ?? 0) * TRUCK_POSITIONS.length,
	);
	const latest = deliveries.latest;

	return (
		<Card className={cn(className)}>
			<CardHeader>
				<CardTitle>{t("overview.deliveriesTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("overview.deliveriesDescription"), {
						count: number.format(deliveries.count),
					})}
				</CardDescription>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<Link to="/app/suppliers">
							{t("suppliers.title")}
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-6">
				<div className="grid @xl/main:grid-cols-3 items-center gap-4">
					<div className="grid justify-items-center gap-1">
						<span aria-hidden="true" className="flex gap-1">
							{TRUCK_POSITIONS.map((position) => (
								<TruckIcon
									key={position}
									weight="fill"
									className={cn(
										"size-6",
										position <= filledTrucks ? "text-primary" : "text-border",
									)}
								/>
							))}
						</span>
						<p className="font-numeric font-semibold text-3xl tabular-nums">
							{deliveries.onTimeRate === null
								? "–"
								: percent.format(deliveries.onTimeRate)}
						</p>
						<p className="text-muted-foreground text-sm">
							{t("overview.onTime")}
						</p>
					</div>
					<ul className="@xl/main:col-span-2 grid gap-3">
						{deliveries.buckets.map((entry) => (
							<li
								key={entry.bucket}
								className="flex items-center gap-2 text-sm"
							>
								<span className="w-20 shrink-0 font-medium">
									{t(`overview.delays.${entry.bucket}`)}
								</span>
								<span className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
									<span
										className={cn(
											"block h-full rounded-full",
											BAR_TONE[entry.bucket],
										)}
										style={{ width: `${(entry.count / largest) * 100}%` }}
									/>
								</span>
								<span className="w-10 shrink-0 text-end text-muted-foreground tabular-nums">
									{number.format(entry.count)}
								</span>
							</li>
						))}
					</ul>
				</div>
				{latest ? (
					<div className="grid gap-2 rounded-md border bg-muted p-4">
						<div className="flex flex-wrap items-start justify-between gap-2">
							<div className="grid gap-1">
								<p className="text-muted-foreground text-xs">
									{t("overview.latestDelivery")}
								</p>
								<Link
									to="/app/purchase-orders"
									search={{ po: latest.orderId }}
									className="font-medium hover:underline"
								>
									{`${latest.number} · ${latest.supplierName}`}
								</Link>
							</div>
							<time
								dateTime={latest.receivedAt}
								className="text-muted-foreground text-xs"
							>
								{date.format(new Date(latest.receivedAt))}
							</time>
						</div>
						<p className="text-muted-foreground text-sm">
							{fillMessage(t("overview.latestDeliveryText"), {
								units: number.format(latest.units),
								unitWord: t(`units.each.${pluralForm(latest.units, locale)}`),
								lines: number.format(latest.lineCount),
								lineWord: t(
									`overview.lineWord.${pluralForm(latest.lineCount, locale)}`,
								),
								day: formatRelativeDay(latest.receivedAt, now, locale),
							})}
						</p>
						<div className="flex flex-wrap items-center gap-2 text-xs">
							<span className="font-medium">{latest.contactName}</span>
							{latest.delayDays > 0 ? (
								<Badge variant="warning">
									{fillMessage(t("overview.daysLate"), {
										days: dayCount.format(latest.delayDays),
									})}
								</Badge>
							) : (
								<Badge variant="success">
									{t(
										latest.delayDays < 0 ? "overview.early" : "overview.onTime",
									)}
								</Badge>
							)}
						</div>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}
