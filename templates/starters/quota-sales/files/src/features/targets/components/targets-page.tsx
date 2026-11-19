// The targets page: the quarter and the export in the header, the team ring and 3 KPI cards,
// the product mix, behind-the-pace, and territories cards, then the table of the rep targets.
// The /app/targets route renders it after its loader, which fills both quarters.
// The quarter select changes the query key, so the page reads the chosen quarter with useQuery.
import {
	CalendarBlankIcon,
	CoinsIcon,
	DownloadSimpleIcon,
	FlagIcon,
	TargetIcon,
} from "@phosphor-icons/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { repCsvColumns } from "~/features/reps";
import {
	changeRatio,
	downloadCsv,
	fillMessage,
	moneyFormat,
	PageError,
	PanelError,
	toCsv,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	QUARTER_CHOICES,
	type QuarterChoice,
	type QuarterTargets,
	quarterTargetsQueryOptions,
} from "../api/targets.queries";
import { BehindPaceCard } from "./behind-pace-card";
import { ProductMixCard } from "./product-mix-card";
import { RepTargetsCard } from "./rep-targets-card";
import { TargetKpiCard } from "./target-kpi-card";
import { TeamProgressCard } from "./team-progress-card";
import { TerritoryPipelineCard } from "./territory-pipeline-card";

/** The page holds the quarter choice. One column on a phone. */
export function TargetsPage() {
	const { t } = useT();
	const [choice, setChoice] = useState<QuarterChoice>("current");
	const query = useQuery({
		...quarterTargetsQueryOptions(choice),
		placeholderData: keepPreviousData,
	});

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("targets.title")}
				description={
					query.data ? (
						<QuarterLine targets={query.data} />
					) : (
						t("targets.description")
					)
				}
				actions={
					<>
						<Select
							value={choice}
							onValueChange={(value) =>
								setChoice(
									QUARTER_CHOICES.find((option) => option === value) ??
										"current",
								)
							}
						>
							<SelectTrigger
								aria-label={t("targets.quarter")}
								className="w-auto gap-2"
							>
								<CalendarBlankIcon className="size-4 text-muted-foreground" />
								<SelectValue />
							</SelectTrigger>
							<SelectContent align="end">
								<SelectItem value="current">{t("targets.current")}</SelectItem>
								<SelectItem value="previous">
									{t("targets.previous")}
								</SelectItem>
							</SelectContent>
						</Select>
						<Button
							type="button"
							aria-label={t("common.exportCsv")}
							disabled={query.data === undefined}
							onClick={() =>
								query.data &&
								downloadCsv(
									`rep-targets-${choice}-quarter.csv`,
									toCsv(query.data.reps, repCsvColumns(t)),
								)
							}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">{t("common.exportCsv")}</span>
						</Button>
					</>
				}
			/>
			{query.isError ? (
				<Card>
					<PanelError
						message={t("targets.loadError")}
						onRetry={() => query.refetch()}
						className="h-64"
					/>
				</Card>
			) : query.data ? (
				<TargetsBody targets={query.data} />
			) : (
				<TargetsBodySkeleton />
			)}
		</div>
	);
}

type TargetsBodyProps = {
	targets: QuarterTargets;
};

// The three bands of the page for one quarter.
function TargetsBody({ targets }: TargetsBodyProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const { team } = targets;
	const gap = Math.max(team.target - team.booked, 0);
	const previousGap = Math.max(team.previousTarget - team.previousBooked, 0);
	const context = fillMessage(t("targets.vsQuarterBefore"), {
		quarter: targets.previousLabel,
	});
	// A target is fixed for the whole quarter, so its comparison has no "same day".
	const targetContext = fillMessage(t("targets.vsQuarter"), {
		quarter: targets.previousLabel,
	});

	return (
		<>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				<TeamProgressCard
					attainment={team.attainment}
					status={team.status}
					quarterLabel={targets.quarterLabel}
					isClosed={targets.isClosed}
					sellingDaysLeft={team.sellingDaysLeft}
				/>
				<TargetKpiCard
					label={t("targets.teamTarget")}
					value={money.format(team.target)}
					change={changeRatio(team.target, team.previousTarget)}
					goodWhen="up"
					context={targetContext}
					icon={TargetIcon}
				/>
				<TargetKpiCard
					label={t("targets.booked")}
					value={money.format(team.booked)}
					change={changeRatio(team.booked, team.previousBooked)}
					goodWhen="up"
					context={context}
					icon={CoinsIcon}
				/>
				<TargetKpiCard
					label={t("targets.gap")}
					value={money.format(gap)}
					change={changeRatio(gap, previousGap)}
					goodWhen="down"
					context={context}
					icon={FlagIcon}
				/>
			</div>
			{/* Two columns on a mid width: the donut beside the reps behind, and the territories under both. */}
			<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-3 gap-4">
				<ProductMixCard productMix={targets.productMix} />
				<BehindPaceCard
					shortfalls={targets.shortfalls}
					pace={targets.progress.pace}
					isClosed={targets.isClosed}
				/>
				<TerritoryPipelineCard territories={targets.territories} />
			</div>
			<RepTargetsCard reps={targets.reps} />
		</>
	);
}

type QuarterLineProps = {
	targets: QuarterTargets;
};

// "Q4 2026, day 48 of 92" for the current quarter, "Q3 2026, closed" for a past one.
function QuarterLine({ targets }: QuarterLineProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	return targets.isClosed
		? fillMessage(t("calendar.quarterClosed"), {
				quarter: targets.quarterLabel,
			})
		: fillMessage(t("calendar.quarterDay"), {
				quarter: targets.quarterLabel,
				day: number.format(targets.progress.elapsedDays + 1),
				total: number.format(targets.progress.totalDays),
			});
}

// Placeholder keys of the KPI row and the middle grid. Fixed keys, because the cards never reorder.
const SKELETON_KPIS = ["1", "2", "3", "4"];
const SKELETON_CARDS = ["1", "2", "3"];

// The three bands while a quarter loads.
function TargetsBodySkeleton() {
	return (
		<>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{SKELETON_KPIS.map((key) => (
					<Skeleton key={key} className="h-40" />
				))}
			</div>
			<div className="grid @2xl/main:grid-cols-2 @4xl/main:grid-cols-3 gap-4">
				{SKELETON_CARDS.map((key) => (
					<Skeleton key={key} className="h-104" />
				))}
			</div>
			<Skeleton className="h-96" />
		</>
	);
}

/** Placeholder while the targets loader runs. The route sets it as pendingComponent. */
export function TargetsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-32" />
					<Skeleton className="h-4 w-56" />
				</div>
				<Skeleton className="h-9 w-64" />
			</div>
			<TargetsBodySkeleton />
		</div>
	);
}

/** Error state of the page when a loader fails. The route sets it as errorComponent. */
export function TargetsPageError() {
	const { t } = useT();
	return <PageError message={t("targets.loadError")} />;
}
