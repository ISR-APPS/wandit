// The Team page behind login: the period tabs, four team figures, and one capacity row per person.
// The /app/team route renders it after its loader, and also uses the skeleton and the error below.
// The period lives in the URL (?days=). A row opens the member sheet.
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	type Figure,
	FigureBand,
	PageError,
	PeriodTabs,
	useFormatters,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { teamLoadQueryOptions } from "../api/team.queries";
import type { MemberLoad } from "../lib/team-load";
import { CapacityRow } from "./capacity-row";
import { MemberSheet } from "./member-sheet";

const route = getRouteApi("/app/team");

/** The sort choices of the capacity list. */
const SORTS = ["utilization", "billable", "name"] as const;

/** One sort choice. Its label is `team.sorts.<sort>`. */
type TeamSort = (typeof SORTS)[number];

/** The order of two members for a sort choice. */
function compareMembers(
	sort: TeamSort,
	first: MemberLoad,
	second: MemberLoad,
): number {
	switch (sort) {
		case "utilization":
			return second.utilization - first.utilization;
		case "billable":
			return second.billable - first.billable;
		case "name":
			return first.name.localeCompare(second.name);
	}
}

/** The Team page. The sheet shows the member of the current period, so a period change updates it. */
export function TeamPage() {
	const { t } = useT();
	const format = useFormatters();
	const { days } = route.useSearch();
	const navigate = route.useNavigate();
	const { data: team } = useSuspenseQuery(teamLoadQueryOptions(days));
	const [sort, setSort] = useState<TeamSort>("utilization");
	// The sheet keeps the last member while it slides out, so the panel never closes empty.
	const [openId, setOpenId] = useState<string | null>(null);
	const [isSheetOpen, setIsSheetOpen] = useState(false);

	const rows = [...team].sort((first, second) =>
		compareMembers(sort, first, second),
	);
	const capacity = team.reduce((sum, member) => sum + member.capacity, 0);
	const billable = team.reduce((sum, member) => sum + member.billable, 0);
	const studio = team.reduce((sum, member) => sum + member.studio, 0);
	const overtime = team.filter((member) => member.utilization > 1).length;
	const scaleHours = Math.max(
		1,
		...team.map((member) =>
			Math.max(member.capacity, member.billable + member.studio),
		),
	);
	const figures: Figure[] = [
		{
			id: "utilization",
			label: t("team.figures.utilization"),
			value: format.percent(capacity === 0 ? 0 : billable / capacity),
		},
		{
			id: "billable",
			label: t("team.figures.billable"),
			value: format.hours(Math.round(billable)),
		},
		{
			id: "studio",
			label: t("team.figures.studio"),
			value: format.hours(Math.round(studio)),
		},
		{
			id: "overtime",
			label: t("team.figures.overtime"),
			value: format.number(overtime),
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("team.title")}
				description={t("team.description").replace(
					"{days}",
					format.number(days),
				)}
				actions={
					<PeriodTabs
						days={days}
						onDaysChange={(next) => void navigate({ search: { days: next } })}
					/>
				}
			/>
			<FigureBand figures={figures} />
			<Card>
				<CardHeader>
					<CardTitle>{t("team.capacityTitle")}</CardTitle>
					{/* A wide header keeps the legend under the title, beside the sort. A narrow one gives it the full width. */}
					<CardDescription className="@max-md/card-header:col-span-2">
						<span className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs">
							<span className="flex items-center gap-1.5">
								<span className="size-2.5 rounded-sm bg-chart-1" />
								{t("team.billable")}
							</span>
							<span className="flex items-center gap-1.5">
								<span className="size-2.5 rounded-sm bg-chart-2" />
								{t("team.studio")}
							</span>
							<span className="flex items-center gap-1.5">
								<span className="h-3 w-0.5 rounded-full bg-chart-3" />
								{t("team.capacity")}
							</span>
						</span>
					</CardDescription>
					<CardAction className="@max-md/card-header:row-span-1">
						<Select
							value={sort}
							onValueChange={(value) =>
								setSort(
									SORTS.find((option) => option === value) ?? "utilization",
								)
							}
						>
							<SelectTrigger className="w-40" aria-label={t("team.sort")}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent align="end">
								{SORTS.map((option) => (
									<SelectItem key={option} value={option}>
										{t(`team.sorts.${option}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</CardAction>
				</CardHeader>
				<CardContent className="-mx-3 grid gap-1 px-6">
					{rows.map((member) => (
						<CapacityRow
							key={member.id}
							member={member}
							scaleHours={scaleHours}
							onOpen={() => {
								setOpenId(member.id);
								setIsSheetOpen(true);
							}}
						/>
					))}
				</CardContent>
			</Card>
			<MemberSheet
				member={team.find((member) => member.id === openId) ?? null}
				open={isSheetOpen}
				days={days}
				onOpenChange={setIsSheetOpen}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function TeamPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-32" />
					<Skeleton className="h-4 w-72" />
				</div>
				<Skeleton className="h-9 w-40" />
			</div>
			<Skeleton className="h-20 rounded-surface" />
			<Card>
				<CardContent className="grid gap-3">
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the Team page when the loader fails. Try again runs the loader again. */
export function TeamPageError() {
	const { t } = useT();
	return <PageError message={t("team.loadError")} />;
}
