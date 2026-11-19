// The home behind login, on the anatomy of the kit project dashboard: the header with the period and the export,
// the tabs Overview and Reports, four KPI cards, the hours chart and the team card, the reminders,
// the approvals and the service donut, then the projects table.
// The /app route renders it after its loader, and also uses the skeleton and the error below.
// The tab and the period live in the URL (?tab=&days=). It reads the overview, projects, and invoice queries.
import {
	CaretDownIcon,
	ClockIcon,
	CoinsIcon,
	ExportIcon,
	KanbanIcon,
	ReceiptIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { invoiceCsvColumns, invoicesQueryOptions } from "~/features/invoices";
import { projectCsvColumns, projectsQueryOptions } from "~/features/projects";
import {
	downloadCsv,
	fillMessage,
	PageError,
	PeriodSelect,
	toCsv,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader } from "~/shared/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";
import type { KitIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { overviewQueryOptions } from "../api/overview.queries";
import type { OverviewKpiId } from "../lib/overview-data";
import { overviewTabSchema } from "../lib/overview-search";
import { ApprovalsCard } from "./approvals-card";
import { HoursOverviewCard } from "./hours-overview-card";
import { KpiCard } from "./kpi-card";
import { ProjectBudgetsCard } from "./project-budgets-card";
import { RecentProjectsCard } from "./recent-projects-card";
import { RemindersCard } from "./reminders-card";
import { ServiceHoursCard } from "./service-hours-card";
import { TeamCard } from "./team-card";

const route = getRouteApi("/app/");

/** The label, the delta context, and the icon of each KPI card. */
const KPI_CARDS = {
	"active-projects": {
		label: "overview.kpis.activeProjects",
		context: "overview.kpis.activeProjectsContext",
		icon: KanbanIcon,
	},
	revenue: {
		label: "overview.kpis.revenue",
		context: "overview.kpis.revenueContext",
		icon: CoinsIcon,
	},
	utilization: {
		label: "overview.kpis.utilization",
		context: "overview.kpis.utilizationContext",
		icon: ClockIcon,
	},
	outstanding: {
		label: "overview.kpis.outstanding",
		context: "overview.kpis.outstandingContext",
		icon: ReceiptIcon,
	},
} as const satisfies Record<
	OverviewKpiId,
	{ label: string; context: string; icon: KitIcon }
>;

/** The home. Both tabs share one period; a change of tab or period writes the URL. */
export function OverviewPage() {
	const { t, locale } = useT();
	const { tab, days } = route.useSearch();
	const navigate = route.useNavigate();
	const { data: overview } = useSuspenseQuery(overviewQueryOptions(days));
	const { data: projects } = useSuspenseQuery(projectsQueryOptions());
	const { data: invoices } = useSuspenseQuery(invoicesQueryOptions());
	const periodLabel = fillMessage(t("period.last"), {
		days: new Intl.NumberFormat(locale).format(days),
	});

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("overview.title")}
				description={fillMessage(t("overview.period"), {
					days: new Intl.NumberFormat(locale).format(days),
				})}
				actions={
					<>
						<PeriodSelect
							days={days}
							onDaysChange={(next) =>
								navigate({
									search: (previous) => ({ ...previous, days: next }),
								})
							}
						/>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline">
									<ExportIcon />
									<span className="hidden lg:inline">
										{t("overview.export")}
									</span>
									<CaretDownIcon className="hidden size-3.5 lg:inline" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onSelect={() =>
										downloadCsv(
											"projects.csv",
											toCsv(projects, projectCsvColumns(t)),
										)
									}
								>
									{t("overview.exportProjects")}
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() =>
										downloadCsv(
											"invoices.csv",
											toCsv(invoices, invoiceCsvColumns(t)),
										)
									}
								>
									{t("overview.exportInvoices")}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</>
				}
			/>
			<Tabs
				value={tab}
				onValueChange={(value) => {
					const next = overviewTabSchema.safeParse(value);
					if (next.success) {
						navigate({
							search: (previous) => ({ ...previous, tab: next.data }),
						});
					}
				}}
				className="gap-4"
			>
				<TabsList>
					<TabsTrigger value="overview">
						{t("overview.tabs.overview")}
					</TabsTrigger>
					<TabsTrigger value="reports">
						{t("overview.tabs.reports")}
					</TabsTrigger>
				</TabsList>
				<TabsContent value="overview" className="grid gap-4">
					<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
						{overview.kpis.map((item) => {
							const card = KPI_CARDS[item.id];
							return (
								<KpiCard
									key={item.id}
									label={t(card.label)}
									value={new Intl.NumberFormat(locale, item.format).format(
										item.value,
									)}
									item={item}
									context={t(card.context)}
									icon={card.icon}
								/>
							);
						})}
					</div>
					<div className="grid @4xl/main:grid-cols-3 gap-4">
						<div className="@4xl/main:col-span-2">
							<HoursOverviewCard points={overview.hours} />
						</div>
						<TeamCard
							headcount={overview.headcount}
							busiest={overview.busiest}
							highlights={overview.highlights}
						/>
					</div>
					<div className="grid @4xl/main:grid-cols-2 @7xl/main:grid-cols-4 gap-4">
						<RemindersCard reminders={overview.reminders} />
						<ApprovalsCard months={overview.approvedByMonth} />
						<ServiceHoursCard
							slices={overview.hoursByService}
							periodLabel={periodLabel}
						/>
					</div>
					<RecentProjectsCard projects={projects} />
				</TabsContent>
				<TabsContent value="reports">
					<ProjectBudgetsCard projects={projects} />
				</TabsContent>
			</Tabs>
		</div>
	);
}

// Placeholder cards of the skeleton. Fixed keys, because the cards never reorder.
const SKELETON_KPIS = ["projects", "revenue", "utilization", "outstanding"];

/** Placeholder while the loader runs: the header, the tabs, the KPI row, the chart band, and the table. */
export function OverviewPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<Skeleton className="h-8 w-56" />
				<Skeleton className="h-9 w-64 max-w-full" />
			</div>
			<Skeleton className="h-9 w-48" />
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{SKELETON_KPIS.map((key) => (
					<Skeleton key={key} className="h-36 rounded-surface" />
				))}
			</div>
			<div className="grid @4xl/main:grid-cols-3 gap-4">
				<Skeleton className="@4xl/main:col-span-2 h-96 rounded-surface" />
				<Skeleton className="h-96 rounded-surface" />
			</div>
			<Card>
				<CardHeader>
					<Skeleton className="h-5 w-40" />
				</CardHeader>
				<CardContent>
					<Skeleton className="h-64 w-full" />
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the home when the loader fails. Try again runs the loader again. */
export function OverviewPageError() {
	const { t } = useT();
	return <PageError message={t("overview.loadError")} />;
}
