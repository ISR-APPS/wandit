// The "Serve times" card of the day report, in the anatomy of the kit customer-reviews card.
// The average on the start side, one bar per serve-time range beside it, then a box with the fastest check.
// ReportPage renders it at the end of the third band. "View all" opens the checks list.
import {
	CaretRightIcon,
	LightningIcon,
	TimerIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { countLabel, fillMessage, formatClock } from "~/features/restaurant";
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
import type { ServeBucket, ServeTimes } from "../lib/day-report";

// One chart color per range, the fastest first, as the colored rating bars of the kit.
const BUCKET_BAR = {
	under10: "bg-chart-1",
	from10to15: "bg-chart-2",
	from15to20: "bg-chart-3",
	from20to30: "bg-chart-4",
	over30: "bg-chart-5",
} satisfies Record<ServeBucket["id"], string>;

type ServeTimesCardProps = {
	serveTimes: ServeTimes;
};

/** Each bar is the share of the served checks in its range. The box links to the fastest check. */
export function ServeTimesCard({ serveTimes }: ServeTimesCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const served = serveTimes.buckets.reduce(
		(sum, bucket) => sum + bucket.checks,
		0,
	);
	const fastest = serveTimes.fastest;

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("report.serveTimes")}</CardTitle>
				<CardDescription>
					{fillMessage(t("report.serveTimesDescription"), {
						checks: countLabel(
							served,
							t("counts.servedChecks.one"),
							t("counts.servedChecks.other"),
							locale,
						),
					})}
				</CardDescription>
				<CardAction>
					<Button asChild size="sm" variant="outline">
						<Link to="/app/orders">
							<span className="@xl/main:inline hidden">
								{t("report.viewAll")}
							</span>
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<div className="grid @xl/main:grid-cols-3 gap-4">
					<div className="flex flex-col items-center justify-center gap-2">
						<TimerIcon aria-hidden="true" className="size-6 text-primary" />
						<span className="font-numeric font-semibold text-3xl tabular-nums">
							{serveTimes.averageMinutes === null
								? "–"
								: number.format(serveTimes.averageMinutes)}
						</span>
						<span className="text-muted-foreground text-sm">
							{t("report.averageMinutes")}
						</span>
					</div>
					<ul className="@xl/main:col-span-2 grid gap-3">
						{serveTimes.buckets.map((bucket) => (
							<li key={bucket.id} className="flex items-center gap-2">
								<span className="w-20 shrink-0 font-medium text-sm">
									{t(`report.serveBuckets.${bucket.id}`)}
								</span>
								<span className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
									{/* The width is the share of the served checks. It grows from the start side. */}
									<span
										className={cn(
											"block h-full rounded-full",
											BUCKET_BAR[bucket.id],
										)}
										style={{
											width: `${served === 0 ? 0 : (bucket.checks / served) * 100}%`,
										}}
									/>
								</span>
								<span className="w-10 shrink-0 text-end font-medium text-muted-foreground text-sm tabular-nums">
									{number.format(bucket.checks)}
								</span>
							</li>
						))}
					</ul>
				</div>
				{fastest ? (
					<div className="mt-6 rounded-md border bg-muted p-4">
						<div className="mb-2 flex @xl/main:flex-row flex-col items-start justify-between gap-1">
							<div className="grid gap-1">
								<span className="flex items-center gap-1 text-primary text-xs">
									<LightningIcon aria-hidden="true" className="size-4" />
									{t("report.fastestCheck")}
								</span>
								<Link
									to="/app/orders/$orderId"
									params={{ orderId: fastest.order.id }}
									className="font-medium hover:underline"
								>
									{fillMessage(t("report.checkAtTable"), {
										number: String(fastest.order.number),
										table: fastest.order.tableName,
									})}
								</Link>
							</div>
							{fastest.order.servedAt ? (
								<span className="text-muted-foreground text-xs tabular-nums">
									{formatClock(fastest.order.servedAt, locale)}
								</span>
							) : null}
						</div>
						<p className="mb-3 text-muted-foreground text-sm">
							{fillMessage(t("report.fastestDetail"), {
								minutes: number.format(fastest.minutes),
								covers: countLabel(
									fastest.order.covers,
									t("counts.covers.one"),
									t("counts.covers.other"),
									locale,
								),
							})}
						</p>
						<div className="flex items-center gap-2 text-xs">
							<span className="font-medium">{fastest.order.serverName}</span>
							<Badge variant="success">
								{t(`zones.${fastest.order.zone}`)}
							</Badge>
						</div>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}
