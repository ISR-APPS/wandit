// The home of the app: the board of matters. The header holds the closed figure, a strip holds four figures,
// then one column per stage from intake to closed, and one line for the matters declined at intake.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// It follows the home "board" of the app-dashboard skill: no drag and drop; a stage changes on the matter page.
import { FlagPennantIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { mattersQueryOptions } from "~/features/matters";
import {
	addLocalDays,
	DEADLINE_SOON_DAYS,
	dayCountFormat,
	fillMessage,
	formatAge,
	STAGE_PATH,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	boardFiguresQueryOptions,
	closedPerDayQueryOptions,
} from "../api/board.queries";
import { BOARD_DAYS, buildBoard } from "../lib/board";
import { BoardColumn } from "./board-column";
import { ClosedThroughput } from "./closed-throughput";
import { FiguresStrip, FiguresStripSkeleton } from "./figures-strip";

// Two cells per row on a phone, four in one row from the 4xl container width.
const STRIP_COLUMNS = "grid-cols-2 @4xl/main:grid-cols-4";

// The age that the legend shows as an example, in days. Any value reads well; 12 looks like a real age.
const AGE_EXAMPLE_DAYS = 12;

/** The board. The columns sit in one row at every width and scroll sideways when they do not fit. */
export function BoardPage() {
	const { t, locale } = useT();
	const { data: matters } = useSuspenseQuery(mattersQueryOptions());
	const { data: closed } = useSuspenseQuery(
		closedPerDayQueryOptions(BOARD_DAYS),
	);
	const { data: figures } = useSuspenseQuery(boardFiguresQueryOptions());
	const now = Date.now();
	const board = buildBoard(matters, now);
	const number = new Intl.NumberFormat(locale);
	const dayCount = dayCountFormat(locale);

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("board.title")}
				description={
					<span className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
						<span>
							{fillMessage(t("board.summaryOpen"), {
								count: number.format(board.openCount),
							})}
						</span>
						<span>
							{fillMessage(t("board.summaryDeadlines"), {
								count: number.format(board.soonDeadlineCount),
							})}
						</span>
					</span>
				}
				actions={<ClosedThroughput points={closed} />}
			/>
			<FiguresStrip
				className={STRIP_COLUMNS}
				items={figures.map(({ labelKey, ...figure }) => ({
					...figure,
					label: t(labelKey),
				}))}
			/>
			{/* The legend sits right above the slips that it explains. */}
			<div className="grid gap-3">
				<div className="flex flex-wrap items-center @3xl/main:justify-end gap-x-5 gap-y-1 text-muted-foreground text-xs">
					<p className="flex items-center gap-1.5">
						<FlagPennantIcon className="size-3.5 text-warning" />
						{fillMessage(t("board.soonLegend"), {
							days: dayCount.format(DEADLINE_SOON_DAYS),
						})}
					</p>
					{/* The slips show the age in the stage with no label, so the legend names it. */}
					<p>
						{fillMessage(t("board.ageLegend"), {
							example: formatAge(
								new Date(addLocalDays(now, -AGE_EXAMPLE_DAYS)).toISOString(),
								now,
								locale,
							),
						})}
					</p>
				</div>
				{/* One column per stage. Columns scroll sideways when they do not fit, and snap at 375 px. */}
				{/* 11.5rem: five columns and four gaps fit beside the open sidebar on a 1280 px screen. */}
				<section
					aria-label={t("board.boardLabel")}
					className="grid @5xl/main:snap-none snap-x snap-mandatory auto-cols-[minmax(11.5rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2"
				>
					{board.columns.map((column) => (
						<BoardColumn key={column.stage} column={column} now={now} />
					))}
				</section>
			</div>
			{/* The line hides while no matter was declined in the period. */}
			{board.declinedCount > 0 ? (
				<p className="text-muted-foreground text-sm">
					{fillMessage(t("board.declinedLine"), {
						period: dayCount.format(BOARD_DAYS),
						count: number.format(board.declinedCount),
					})}{" "}
					<Link
						to="/app/matters"
						search={{ stage: "declined" }}
						className="inline-flex min-h-11 items-center text-foreground underline decoration-ring underline-offset-4 hover:decoration-2"
					>
						{t("board.viewDeclined")}
					</Link>
				</p>
			) : null}
		</div>
	);
}

// Placeholder slips of one skeleton column. Fixed keys, because they never reorder.
const SKELETON_SLIPS = ["1", "2", "3"];

/** Placeholder while the loader runs: the header, the strip, and one column per stage with 3 slips. */
export function BoardPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-4 w-80 max-w-full" />
				</div>
				<Skeleton className="h-11 w-72 max-w-full" />
			</div>
			<FiguresStripSkeleton count={4} className={STRIP_COLUMNS} />
			<div className="grid auto-cols-[minmax(11.5rem,1fr)] grid-flow-col gap-3 overflow-hidden">
				{STAGE_PATH.map((stage) => (
					<div key={stage} className="grid content-start gap-2.5">
						<Skeleton className="h-14" />
						{SKELETON_SLIPS.map((slip) => (
							<Skeleton key={slip} className="h-32" />
						))}
					</div>
				))}
			</div>
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
export function BoardPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("board.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
