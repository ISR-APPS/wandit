// The readiness card of the home: the content items of the next 14 days by stage, as a donut and three counts.
// OverviewPage renders it beside the 7-day report. It reads contentItemsQueryOptions of the calendar barrel.
// "Ready" is a scheduled item: approved and queued. Drafts and items in review still need work.
import {
	CalendarCheckIcon,
	ChatCircleDotsIcon,
	PencilSimpleLineIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { contentItemsQueryOptions } from "~/features/calendar";
import { type ContentStage, DAY_MS } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardFooter } from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";

const ReadinessDonut = lazy(() =>
	import("./readiness-donut").then((module) => ({
		default: module.ReadinessDonut,
	})),
);

// The card looks two weeks ahead: the horizon of a weekly content review.
const HORIZON_MS = 14 * DAY_MS;

/** The three stages before an item goes out, in the order of the work, with the chart color of each. */
const STAGES = [
	{
		status: "scheduled",
		icon: CalendarCheckIcon,
		chip: "border-chart-1 bg-chart-1/15",
		color: "var(--chart-1)",
	},
	{
		status: "in_review",
		icon: ChatCircleDotsIcon,
		chip: "border-chart-2 bg-chart-2/15",
		color: "var(--chart-2)",
	},
	{
		status: "drafting",
		icon: PencilSimpleLineIcon,
		chip: "border-chart-3 bg-chart-3/15",
		color: "var(--chart-3)",
	},
] as const satisfies readonly {
	status: ContentStage;
	icon: KitIcon;
	chip: string;
	color: string;
}[];

/** The card has no header: the center caption and the footer name the figures, as in the kit. */
export function ContentReadinessCard() {
	const { t, locale } = useT();
	const { data: items } = useSuspenseQuery(contentItemsQueryOptions());
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();
	const upcoming = items.filter((item) => {
		const goesOutIn = Date.parse(item.scheduledAt) - now;
		return goesOutIn > 0 && goesOutIn <= HORIZON_MS;
	});
	const counts = STAGES.map((stage) => ({
		...stage,
		label: t(`contentStatus.${stage.status}`),
		value: upcoming.filter((item) => item.status === stage.status).length,
	}));
	const readyCount =
		counts.find((stage) => stage.status === "scheduled")?.value ?? 0;

	return (
		<Card className="@container/readiness h-full">
			<h2 className="sr-only">{t("overview.readinessTitle")}</h2>
			<CardContent className="flex flex-1 items-center">
				<Suspense
					fallback={<Skeleton className="mx-auto size-60 rounded-full" />}
				>
					<ReadinessDonut
						slices={counts.map((stage) => ({
							key: stage.status,
							label: stage.label,
							value: stage.value,
							color: stage.color,
						}))}
						readyShare={
							upcoming.length === 0 ? null : readyCount / upcoming.length
						}
					/>
				</Suspense>
			</CardContent>
			{/* The 3 stages always sit side by side, as in the kit. A 4/12 card is too narrow for the chip beside the label, so the chip goes on top. */}
			<CardFooter className="grid grid-cols-3 gap-2 border-t pt-6">
				{counts.map((stage) => {
					const Icon = stage.icon;
					return (
						<div
							key={stage.status}
							className="flex @md/readiness:flex-row flex-col items-start @md/readiness:items-center @md/readiness:gap-3 gap-2"
						>
							<span
								className={cn(
									"flex size-10 shrink-0 items-center justify-center rounded-full border",
									stage.chip,
								)}
							>
								<Icon className="size-4" />
							</span>
							<div className="grid min-w-0">
								<span className="text-sm">{stage.label}</span>
								<span className="text-muted-foreground text-sm tabular-nums">
									{number.format(stage.value)}
								</span>
							</div>
						</div>
					);
				})}
			</CardFooter>
			<p className="sr-only">{t("overview.readinessHint")}</p>
		</Card>
	);
}
