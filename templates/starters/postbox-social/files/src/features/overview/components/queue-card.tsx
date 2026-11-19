// The narrow card of the second band: the post queue as a donut, with the ready share in the hole,
// and a footer of three counts with tinted chips: scheduled, drafts, failed.
// OverviewPage renders it in 4 of 12 columns. The queue does not follow the period: it is the queue of now.
import {
	CalendarCheckIcon,
	NotePencilIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import { lazy, Suspense } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardFooter } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { OverviewData } from "../api/overview.queries";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const QueueDonut = lazy(() =>
	import("./queue-donut").then((module) => ({ default: module.QueueDonut })),
);

type QueueCardProps = {
	queue: OverviewData["queue"];
};

/** "Ready" is the share of scheduled posts in the queue: a draft needs a slot, a failed post needs a fix. */
export function QueueCard({ queue }: QueueCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const total = queue.scheduled + queue.drafts + queue.failed;
	const ready = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	}).format(total === 0 ? 0 : queue.scheduled / total);
	const parts = [
		{
			key: "scheduled",
			label: t("overview.queue.scheduled"),
			value: queue.scheduled,
			color: "var(--chart-1)",
			icon: CalendarCheckIcon,
			chip: "border-success/40 bg-success/15 text-success",
		},
		{
			key: "drafts",
			label: t("overview.queue.drafts"),
			value: queue.drafts,
			color: "var(--chart-2)",
			icon: NotePencilIcon,
			chip: "border-warning/40 bg-warning/15 text-warning",
		},
		{
			key: "failed",
			label: t("overview.queue.failed"),
			value: queue.failed,
			color: "var(--chart-3)",
			icon: WarningCircleIcon,
			chip: "border-destructive/40 bg-destructive/15 text-destructive",
		},
	];

	return (
		<Card className="h-full" aria-labelledby="queue-card-title">
			<h2 id="queue-card-title" className="sr-only">
				{t("overview.queue.title")}
			</h2>
			<CardContent className="flex flex-1 items-center justify-center">
				<Suspense fallback={<Skeleton className="size-60 rounded-full" />}>
					<QueueDonut
						slices={parts.map(({ key, label, value, color }) => ({
							key,
							label,
							value,
							color,
						}))}
						centerValue={ready}
						centerLabel={t("overview.queue.ready")}
						ariaLabel={`${t("overview.queue.title")}: ${parts
							.map((part) => `${part.label} ${number.format(part.value)}`)
							.join(", ")}`}
					/>
				</Suspense>
			</CardContent>
			<CardFooter className="grid grid-cols-3 gap-2 border-t pt-6">
				{parts.map((part) => (
					// The icon sits above the text: in 4 of 12 columns a row leaves too little width for "Scheduled".
					<div
						key={part.key}
						className="flex min-w-0 flex-col items-center gap-2 text-center"
					>
						<span
							className={cn(
								"flex size-9 shrink-0 items-center justify-center rounded-full border",
								part.chip,
							)}
						>
							<part.icon className="size-4" />
						</span>
						<div className="grid min-w-0">
							<span className="truncate text-sm">{part.label}</span>
							<span className="text-muted-foreground text-sm tabular-nums">
								{number.format(part.value)}
							</span>
						</div>
					</div>
				))}
			</CardFooter>
		</Card>
	);
}
