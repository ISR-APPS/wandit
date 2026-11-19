// The matter list behind login: the page header, the status tabs, the area filter, and a grid of matter cards.
// The /app/matters route renders it after its loader. The route also uses the skeleton and the error below.
// It follows the kit project list. The tab and the area live in the URL (?status=closed&area=family).
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	downloadCsv,
	fillMessage,
	isOpenStage,
	PRACTICE_AREAS,
	toCsv,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { mattersQueryOptions } from "../api/matters.queries";
import { matterCsvColumns } from "../lib/matter-csv";
import type { MatterSummary } from "../lib/matter-joins";
import {
	MATTER_STATUSES,
	type MatterStatus,
	mattersSearchSchema,
} from "../lib/matters-search";
import { MatterCard } from "./matter-card";

// The value of the "All areas" choice. A Select item cannot have an empty value.
const ALL_AREAS = "all";

// Twelve cards fill three rows of four on a laptop. "Show more" adds the next twelve.
const CARDS_PER_STEP = 12;

/** The status of a matter for the tabs: one of the four open stages, closed, or declined. */
function statusOf(matter: MatterSummary): MatterStatus {
	return isOpenStage(matter.stage)
		? "open"
		: matter.stage === "closed"
			? "closed"
			: "declined";
}

/** The area filter and the status tab cut the rows. The cards show the newest opening first. */
export function MattersPage() {
	const { t, locale } = useT();
	const { data: matters } = useSuspenseQuery(mattersQueryOptions());
	const search = useSearch({ from: "/app/matters/" });
	const navigate = useNavigate({ from: "/app/matters/" });
	const number = new Intl.NumberFormat(locale);
	const status = search.status ?? "open";
	const inArea = search.area
		? matters.filter((matter) => matter.area === search.area)
		: matters;
	const rows = inArea.filter((matter) => statusOf(matter) === status);

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("matters.title")}
				description={t("matters.description")}
				actions={
					<>
						<Select
							value={search.area ?? ALL_AREAS}
							onValueChange={(value) => {
								const parsed = mattersSearchSchema.shape.area.parse(value);
								navigate({
									search: (previous) => ({ ...previous, area: parsed }),
								});
							}}
						>
							<SelectTrigger
								aria-label={t("matters.areaFilter")}
								className="w-auto"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent align="end">
								<SelectItem value={ALL_AREAS}>
									{t("matters.allAreas")}
								</SelectItem>
								{PRACTICE_AREAS.map((area) => (
									<SelectItem key={area} value={area}>
										{t(`areas.${area}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							type="button"
							aria-label={t("common.exportCsv")}
							onClick={() =>
								downloadCsv("matters.csv", toCsv(rows, matterCsvColumns(t)))
							}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">{t("common.exportCsv")}</span>
						</Button>
					</>
				}
			/>
			<Tabs
				value={status}
				onValueChange={(value) => {
					const parsed = mattersSearchSchema.shape.status.parse(value);
					// "open" is the default tab, so the URL leaves it out.
					navigate({
						search: (previous) => ({
							...previous,
							status: parsed === "open" ? undefined : parsed,
						}),
					});
				}}
			>
				<TabsList>
					{MATTER_STATUSES.map((value) => (
						<TabsTrigger key={value} value={value}>
							{t(`matters.statuses.${value}`)}
							<span className="text-muted-foreground text-xs tabular-nums">
								{number.format(
									inArea.filter((matter) => statusOf(matter) === value).length,
								)}
							</span>
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			{/* The key gives a new tab or area its own "Show more" count, from twelve cards. */}
			<MatterCardGrid
				key={`${status}-${search.area ?? ALL_AREAS}`}
				rows={rows}
			/>
		</div>
	);
}

type MatterCardGridProps = {
	/** The matters of the chosen tab and area, newest opening first. */
	rows: MatterSummary[];
};

// The grid of cards and the "Show more" button. The count of shown cards is its own state.
function MatterCardGrid({ rows }: MatterCardGridProps) {
	const { t, locale } = useT();
	const [shownCount, setShownCount] = useState(CARDS_PER_STEP);
	const now = Date.now();
	if (rows.length === 0) {
		return (
			<p className="rounded-surface border border-dashed p-10 text-center text-muted-foreground text-sm">
				{t("matters.noResults")}
			</p>
		);
	}
	return (
		<>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{rows.slice(0, shownCount).map((matter) => (
					<MatterCard key={matter.id} matter={matter} now={now} />
				))}
			</div>
			{rows.length > shownCount ? (
				<Button
					type="button"
					variant="outline"
					className="justify-self-center"
					onClick={() => setShownCount(shownCount + CARDS_PER_STEP)}
				>
					{fillMessage(t("matters.showMore"), {
						count: new Intl.NumberFormat(locale).format(
							rows.length - shownCount,
						),
					})}
				</Button>
			) : null}
		</>
	);
}

// Placeholder keys of the card grid. Fixed keys, because the placeholders never reorder.
const SKELETON_CARDS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function MattersPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<Skeleton className="h-9 w-56 max-w-full" />
			</div>
			<Skeleton className="h-9 w-72 max-w-full" />
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{SKELETON_CARDS.map((key) => (
					<Skeleton key={key} className="h-60" />
				))}
			</div>
		</div>
	);
}

/** Error state when a matter loader fails. Try again runs the loader again. */
export function MattersPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("matters.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
