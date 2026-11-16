// The home of the app: the pipeline board. One column per stage, with the count and the amount in the column head,
// the won figure in the page header, and one line for the lost deals under the board.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// It follows the home "board" of the app-dashboard skill: no figure panels, and no drag and drop.
import { FlagPennantIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	dayCountFormat,
	fillMessage,
	moneyFormat,
	STALLED_AFTER_DAYS,
	WINNING_PATH,
} from "~/features/crm";
import { dealsQueryOptions, wonPerDayQueryOptions } from "~/features/deals";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import { BOARD_DAYS, buildBoard } from "../lib/board";
import { BoardColumn } from "./board-column";
import { WonThroughput } from "./won-throughput";

/** The board. The columns sit in one row at every width and scroll sideways when they do not fit. */
export function PipelinePage() {
	const { t, locale } = useT();
	const { data: deals } = useSuspenseQuery(dealsQueryOptions());
	const { data: wonPerDay } = useSuspenseQuery(
		wonPerDayQueryOptions(BOARD_DAYS),
	);
	const now = Date.now();
	const board = buildBoard(deals, now);
	const number = new Intl.NumberFormat(locale);
	const compactMoney = moneyFormat(locale, "compact");
	const dayCount = dayCountFormat(locale);
	// The three totals of the open deals, under the title. The board names no other total.
	const summary = [
		{
			value: number.format(board.open.count),
			label: t("pipeline.openDeals"),
		},
		{
			value: compactMoney.format(board.open.amount),
			label: t("pipeline.inPipeline"),
		},
		{
			value: compactMoney.format(board.open.weighted),
			label: t("pipeline.weightedForecast"),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("pipeline.title")}
				description={
					<span className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
						{summary.map((part) => (
							<span key={part.label}>
								<span className="font-medium text-foreground tabular-nums">
									{part.value}
								</span>{" "}
								{part.label}
							</span>
						))}
					</span>
				}
				actions={<WonThroughput points={wonPerDay} />}
			/>
			{/* One column per pipeline stage. Columns scroll sideways when they do not fit, and snap at 375 px. */}
			{/* 11.5rem: five columns and four gaps fit beside the open sidebar on a 1280 px screen. */}
			<section
				aria-label={t("pipeline.boardLabel")}
				className="grid @4xl/main:snap-none snap-x snap-mandatory auto-cols-[minmax(11.5rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2"
			>
				{board.columns.map((column) => (
					<BoardColumn key={column.stage} column={column} now={now} />
				))}
			</section>
			<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-muted-foreground text-sm">
				{/* The line hides while no deal was lost in the period. */}
				{board.lost.count > 0 ? (
					<p>
						{fillMessage(t("pipeline.lostLine"), {
							period: dayCount.format(BOARD_DAYS),
							count: number.format(board.lost.count),
							amount: compactMoney.format(board.lost.amount),
						})}{" "}
						<Link
							to="/app/deals"
							search={{ stage: "lost" }}
							className="text-foreground underline decoration-ring underline-offset-4 hover:decoration-2"
						>
							{t("pipeline.viewLost")}
						</Link>
					</p>
				) : null}
				<p className="flex items-center gap-1.5">
					<FlagPennantIcon className="size-4 text-warning" />
					{fillMessage(t("pipeline.stalledLegend"), {
						days: dayCount.format(STALLED_AFTER_DAYS),
					})}
				</p>
			</div>
		</div>
	);
}

// Placeholder slips of one skeleton column. Fixed keys, because they never reorder.
const SKELETON_SLIPS = ["1", "2", "3"];

/** Placeholder while the loader runs: the header and one column per stage with 3 slips. The route sets it as pendingComponent. */
export function PipelinePageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-36" />
					<Skeleton className="h-4 w-80 max-w-full" />
				</div>
				<Skeleton className="h-12 w-72 max-w-full" />
			</div>
			<div className="grid auto-cols-[minmax(11.5rem,1fr)] grid-flow-col gap-3 overflow-hidden">
				{WINNING_PATH.map((stage) => (
					<div key={stage} className="grid content-start gap-2">
						<Skeleton className="h-16" />
						{SKELETON_SLIPS.map((slip) => (
							<Skeleton key={slip} className="h-24" />
						))}
					</div>
				))}
			</div>
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
export function PipelinePageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("pipeline.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
