// The home behind login: the tabbed overview of the studio. Tabs: Overview, Projects, Team, Invoices.
// The /app route renders it after its loader, and also uses the skeleton and the error below.
// The tab and the period live in the URL (?tab=&days=). It reads the overview, projects, team, and invoice queries.
import {
	ClockIcon,
	CoinsIcon,
	FolderOpenIcon,
	ReceiptIcon,
	UsersThreeIcon,
	WarningDiamondIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { invoicesQueryOptions } from "~/features/invoices";
import { projectsQueryOptions } from "~/features/projects";
import { daysBetween, PageError, PeriodTabs } from "~/features/studio";
import { teamLoadQueryOptions } from "~/features/team";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { overviewQueryOptions } from "../api/overview.queries";
import type { OverviewKpi, OverviewKpiId } from "../lib/overview-data";
import { type OverviewTab, overviewTabSchema } from "../lib/overview-search";
import { DueProjectsCard } from "./due-projects-card";
import { EntityRow } from "./entity-row";
import { FiguresCard } from "./figures-card";
import { OpenInvoicesCard } from "./open-invoices-card";
import { ServiceBreakdownCard } from "./service-breakdown-card";
import { TeamUtilizationCard } from "./team-utilization-card";
import { TrendCard } from "./trend-card";

const route = getRouteApi("/app/");

/** The figures card shows these three, in this order. The entity rows show the other three. */
const FIGURE_IDS = [
	"outstanding",
	"utilization",
	"projects-at-risk",
] as const satisfies readonly OverviewKpiId[];

/** The overview. Every tab shares one period; a change of tab or period writes the URL. */
export function OverviewPage() {
	const { t, locale } = useT();
	const { tab, days } = route.useSearch();
	const navigate = route.useNavigate();
	const { data: overview } = useSuspenseQuery(overviewQueryOptions(days));
	const { data: projects } = useSuspenseQuery(projectsQueryOptions());
	const { data: invoices } = useSuspenseQuery(invoicesQueryOptions());
	const { data: team } = useSuspenseQuery(teamLoadQueryOptions(days));

	const number = new Intl.NumberFormat(locale);
	const kpi = (id: OverviewKpiId): OverviewKpi => {
		const item = overview.kpis.find((row) => row.id === id);
		if (!item) {
			throw new Error(`Missing overview figure ${id}`);
		}
		return item;
	};
	const liveProjects = projects.filter((project) => project.isLive);
	// Retainers have no due day, so they stay out of the "Due next" table.
	const dueProjects = liveProjects
		.flatMap((project) =>
			project.dueDay === null ? [] : [{ project, dueDay: project.dueDay }],
		)
		.sort((first, second) => daysBetween(second.dueDay, first.dueDay))
		.map((row) => row.project);
	// Overdue money first, then the invoice that falls due soonest: the order of the payment chase.
	const openInvoices = invoices
		.filter(
			(invoice) => invoice.status === "sent" || invoice.status === "overdue",
		)
		.sort(
			(first, second) =>
				Number(second.status === "overdue") -
					Number(first.status === "overdue") ||
				daysBetween(second.dueDay, first.dueDay),
		);
	const loadedTeam = [...team].sort(
		(first, second) => second.utilization - first.utilization,
	);
	const tabs: { value: Exclude<OverviewTab, "overview">; count: number }[] = [
		{ value: "projects", count: liveProjects.length },
		{ value: "team", count: team.length },
		{ value: "invoices", count: openInvoices.length },
	];
	const serviceSlices = overview.hoursByService.map((slice) => ({
		label: t(`codes.services.${slice.service}`),
		value: slice.value,
	}));
	const periodText = t("overview.period").replace(
		"{days}",
		number.format(days),
	);

	return (
		<Tabs
			value={tab}
			onValueChange={(value) => {
				const next = overviewTabSchema.safeParse(value);
				if (next.success) {
					void navigate({
						search: (previous) => ({ ...previous, tab: next.data }),
					});
				}
			}}
			className="gap-6"
		>
			<div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
				<div className="grid min-w-0 gap-1">
					<h1 className="font-(--heading-weight) font-display text-3xl tracking-(--heading-tracking)">
						{t("overview.title")}
					</h1>
					<p className="text-muted-foreground text-sm">{periodText}</p>
				</div>
				{/* 375 px: the strip scrolls sideways and never wraps. */}
				<div className="max-w-full overflow-x-auto">
					<TabsList className="max-md:group-data-[orientation=horizontal]/tabs:h-11">
						<TabsTrigger value="overview" className="px-3">
							{t("overview.tabs.overview")}
						</TabsTrigger>
						{tabs.map((item) => (
							<TabsTrigger key={item.value} value={item.value} className="px-3">
								{t(`overview.tabs.${item.value}`)}
								{/* Opacity, not a muted color: the active tab can be a dark chip. */}
								<span className="tabular-nums opacity-60">
									{number.format(item.count)}
								</span>
							</TabsTrigger>
						))}
					</TabsList>
				</div>
			</div>
			<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
				<p className="text-muted-foreground text-sm">
					{t("overview.periodNote")}
				</p>
				<PeriodTabs
					days={days}
					onDaysChange={(next) =>
						void navigate({
							search: (previous) => ({ ...previous, days: next }),
						})
					}
				/>
			</div>

			<TabsContent value="overview" className="grid @3xl/main:gap-6 gap-4">
				<div className="grid gap-4">
					<EntityRow
						tab="projects"
						name={t("overview.tabs.projects")}
						icon={FolderOpenIcon}
						item={kpi("deliverables")}
						label={t("overview.figures.deliverables")}
						hint={t("overview.weeklyTotal")}
						points={overview.weeklyDeliverables}
					/>
					<EntityRow
						tab="team"
						name={t("overview.tabs.team")}
						icon={UsersThreeIcon}
						item={kpi("billable-hours")}
						label={t("overview.figures.billableHours")}
						hint={t("overview.weeklyTotal")}
						points={overview.weeklyHours}
					/>
					<EntityRow
						tab="invoices"
						name={t("overview.tabs.invoices")}
						icon={ReceiptIcon}
						item={kpi("cash-collected")}
						label={t("overview.figures.cashCollected")}
						hint={t("overview.weeklyTotal")}
						points={overview.weeklyCash}
					/>
				</div>
				<div className="grid @4xl/main:grid-cols-2 grid-cols-1 @3xl/main:gap-6 gap-4">
					<ServiceBreakdownCard
						title={t("overview.hoursByService")}
						slices={serviceSlices}
					/>
					<FiguresCard
						title={t("overview.studioHealth")}
						rows={FIGURE_IDS.map((id) => ({
							item: kpi(id),
							label: t(FIGURE_LABELS[id]),
							icon: FIGURE_ICONS[id],
							note:
								id === "projects-at-risk"
									? t("overview.figures.atRiskNote").replace(
											"{count}",
											number.format(liveProjects.length),
										)
									: undefined,
						}))}
					/>
				</div>
			</TabsContent>

			<TabsContent
				value="projects"
				className="grid @4xl/main:grid-cols-2 grid-cols-1 @3xl/main:gap-6 gap-4"
			>
				<TrendCard
					title={t("overview.figures.deliverables")}
					description={t("overview.runningTotalNote")}
					points={overview.deliverables}
				/>
				<DueProjectsCard projects={dueProjects} />
			</TabsContent>

			<TabsContent
				value="team"
				className="grid @4xl/main:grid-cols-2 grid-cols-1 @3xl/main:gap-6 gap-4"
			>
				<TrendCard
					title={t("overview.figures.billableHours")}
					description={t("overview.runningTotalNote")}
					points={overview.hours}
					format={kpi("billable-hours").format}
				/>
				<TeamUtilizationCard members={loadedTeam} />
			</TabsContent>

			<TabsContent
				value="invoices"
				className="grid @4xl/main:grid-cols-2 grid-cols-1 @3xl/main:gap-6 gap-4"
			>
				<TrendCard
					title={t("overview.figures.cashCollected")}
					description={t("overview.runningTotalNote")}
					points={overview.cash}
					format={kpi("cash-collected").format}
				/>
				<OpenInvoicesCard invoices={openInvoices} />
			</TabsContent>
		</Tabs>
	);
}

/** The message key of each figure of the figures card. */
const FIGURE_LABELS = {
	outstanding: "overview.figures.outstanding",
	utilization: "overview.figures.utilization",
	"projects-at-risk": "overview.figures.projectsAtRisk",
} as const;

/** The icon of each figure of the figures card: the thing it counts. */
const FIGURE_ICONS = {
	outstanding: CoinsIcon,
	utilization: ClockIcon,
	"projects-at-risk": WarningDiamondIcon,
} as const;

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["projects", "team", "invoices"];

/** Placeholder while the loader runs: the header, the tabs, three entity rows, and the bottom row. */
export function OverviewPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div className="grid gap-2">
					<Skeleton className="h-9 w-56" />
					<Skeleton className="h-4 w-72" />
				</div>
				<Skeleton className="h-9 w-96 max-w-full" />
			</div>
			<div className="flex justify-end border-t pt-4">
				<Skeleton className="h-9 w-40" />
			</div>
			{SKELETON_ROWS.map((key) => (
				<Skeleton key={key} className="h-36 rounded-surface" />
			))}
			<div className="grid @4xl/main:grid-cols-2 grid-cols-1 gap-4">
				<Card>
					<CardHeader>
						<Skeleton className="h-5 w-48" />
					</CardHeader>
					<CardContent className="grid gap-3">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-32 w-full" />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<Skeleton className="h-5 w-40" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-40 w-full" />
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

/** Error state of the home when the loader fails. Try again runs the loader again. */
export function OverviewPageError() {
	const { t } = useT();
	return <PageError message={t("overview.loadError")} />;
}
