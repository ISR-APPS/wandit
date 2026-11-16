// The time-off page behind login: four figures, the two-week planner, and the table of every request.
// The /app/time-off route renders it after its loader. The route also uses the skeleton and the error below.
// A request in the URL (?request=) opens its dialog. The status tabs and the type filter cut the table.
// Narrow screens show fewer columns. A phone shows the person with the type, and the dates with the status.
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	CARD_TITLE_CLASS,
	dayKeyToMs,
	formatRelativeTime,
	KpiFigures,
	KpiFiguresSkeleton,
	PersonAvatar,
	TIME_OFF_STATUS_BADGE,
	TIME_OFF_STATUSES,
	TIME_OFF_TYPES,
	type TimeOffStatus,
	type TimeOffType,
	TimeOffTypeMark,
	useIsWideScreen,
} from "~/features/people";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { CaretRightIcon } from "~/shared/ui/icons";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { useSidebar } from "~/shared/ui/sidebar";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	plannerQueryOptions,
	type TimeOffRequest,
	timeOffKpisQueryOptions,
	timeOffRequestsQueryOptions,
} from "../api/time-off.queries";
import { PlannerCard } from "./planner-card";
import { RequestDialog } from "./request-dialog";

const routeApi = getRouteApi("/app/time-off");

// The grid of the figure row: two columns on a phone, four from a 42rem main column (a 1024 px screen).
const KPI_GRID = "grid-cols-2 @2xl/main:grid-cols-4";
// The columns that fit with no cut text: a 390 px phone, then a laptop under 1280 px.
// The dates link opens the dialog on a phone. The dialog shows the days and the sent time.
const PHONE_COLUMN_IDS = new Set(["employee", "dates"]);
const LAPTOP_COLUMN_IDS = new Set([
	"employee",
	"type",
	"dates",
	"status",
	"open",
]);

/** The time-off page. The tab and the type filter cut the rows; then DataTable searches, sorts, and pages them. */
export function TimeOffPage() {
	const { t, locale } = useT();
	const { data: requests } = useSuspenseQuery(timeOffRequestsQueryOptions());
	const { data: kpis } = useSuspenseQuery(timeOffKpisQueryOptions());
	const { data: planner } = useSuspenseQuery(plannerQueryOptions());
	const { isMobile } = useSidebar();
	const isWideScreen = useIsWideScreen();
	const { request: requestId } = routeApi.useSearch();
	const navigate = routeApi.useNavigate();
	const [status, setStatus] = useState<TimeOffStatus | "all">("all");
	const [type, setType] = useState<TimeOffType | "all">("all");
	// The id of the request that the dialog showed last. The dialog keeps it while it closes.
	const [closingId, setClosingId] = useState<string | null>(null);

	const number = new Intl.NumberFormat(locale);
	const dayCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const dateFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const now = Date.now();
	const openRequest = requests.find((row) => row.id === requestId) ?? null;
	const dialogRequest =
		openRequest ?? requests.find((row) => row.id === closingId) ?? null;

	const ofType =
		type === "all" ? requests : requests.filter((row) => row.type === type);
	// A tab shows only for a status that has rows of the chosen type.
	const tabs = TIME_OFF_STATUSES.map((value) => ({
		value,
		count: ofType.filter((row) => row.status === value).length,
	})).filter((tab) => tab.count > 0);
	const activeStatus = tabs.some((tab) => tab.value === status)
		? status
		: "all";
	const rows =
		activeStatus === "all"
			? ofType
			: ofType.filter((row) => row.status === activeStatus);

	function openDetail(id: string) {
		navigate({ search: { request: id }, replace: true });
	}

	const columns: DataTableColumn<TimeOffRequest>[] = [
		{
			id: "employee",
			header: t("timeOff.employee"),
			sortValue: (row) => row.employeeName,
			cell: (row) => (
				<div className="flex items-center gap-3">
					<PersonAvatar name={row.employeeName} />
					<div className="grid justify-items-start">
						<Link
							to="/app/employees/$employeeId"
							params={{ employeeId: row.employeeId }}
							className="font-medium hover:underline"
							dir="auto"
						>
							{row.employeeName}
						</Link>
						{isMobile ? (
							<TimeOffTypeMark
								type={row.type}
								className="text-muted-foreground text-xs"
							/>
						) : (
							<span className="text-muted-foreground text-xs">
								{t(`departments.${row.department}`)}
							</span>
						)}
					</div>
				</div>
			),
		},
		{
			id: "type",
			header: t("timeOff.type"),
			sortValue: (row) => TIME_OFF_TYPES.indexOf(row.type),
			cell: (row) => (
				<TimeOffTypeMark type={row.type} className="whitespace-nowrap" />
			),
		},
		{
			id: "dates",
			header: t("timeOff.dates"),
			sortValue: (row) => row.startDate,
			cell: (row) => (
				<div className="grid justify-items-start gap-1">
					<Link
						to="/app/time-off"
						search={{ request: row.id }}
						replace
						resetScroll={false}
						className="whitespace-nowrap tabular-nums hover:underline"
					>
						{dateFormat.formatRange(
							new Date(dayKeyToMs(row.startDate)),
							new Date(dayKeyToMs(row.endDate)),
						)}
					</Link>
					{isMobile ? (
						<Badge variant={TIME_OFF_STATUS_BADGE[row.status]}>
							{t(`timeOffStatuses.${row.status}`)}
						</Badge>
					) : null}
				</div>
			),
		},
		{
			id: "days",
			header: t("timeOff.days"),
			align: "end",
			sortValue: (row) => row.days,
			cell: (row) => (
				<span className="whitespace-nowrap">{dayCount.format(row.days)}</span>
			),
		},
		{
			id: "sent",
			header: t("timeOff.sent"),
			sortValue: (row) => Date.parse(row.submittedAt),
			cell: (row) => (
				<span className="whitespace-nowrap text-muted-foreground">
					{formatRelativeTime(row.submittedAt, now, locale)}
				</span>
			),
		},
		{
			id: "status",
			header: t("timeOff.status"),
			sortValue: (row) => TIME_OFF_STATUSES.indexOf(row.status),
			cell: (row) => (
				<Badge variant={TIME_OFF_STATUS_BADGE[row.status]}>
					{t(`timeOffStatuses.${row.status}`)}
				</Badge>
			),
		},
		{
			id: "open",
			header: "",
			align: "end",
			cell: (row) => (
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-9"
					aria-label={`${t("timeOff.openRequest")} ${row.id}`}
					onClick={() => openDetail(row.id)}
				>
					<CaretRightIcon className="rtl:rotate-180" />
				</Button>
			),
		},
	];
	const visibleColumns = isWideScreen
		? columns
		: columns.filter((column) =>
				(isMobile ? PHONE_COLUMN_IDS : LAPTOP_COLUMN_IDS).has(column.id),
			);

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("timeOff.title")}
				description={t("timeOff.description")}
			/>
			<KpiFigures
				items={kpis.map(({ labelKey, noteKey, ...item }) => ({
					...item,
					label: t(labelKey),
					note: noteKey ? t(noteKey) : undefined,
				}))}
				className={KPI_GRID}
			/>
			<PlannerCard planner={planner} />
			<Card>
				<CardHeader>
					<CardTitle className={CARD_TITLE_CLASS}>
						{t("timeOff.requestsTitle")}
					</CardTitle>
					<CardDescription>{t("timeOff.requestsDescription")}</CardDescription>
				</CardHeader>
				<CardContent>
					<DataTable
						rows={rows}
						columns={visibleColumns}
						searchText={(row) =>
							`${row.employeeName} ${row.id} ${t(`departments.${row.department}`)}`
						}
						noResults={t("timeOff.noResults")}
						toolbar={
							<>
								<Tabs
									value={activeStatus}
									onValueChange={(value) =>
										setStatus(
											TIME_OFF_STATUSES.find((option) => option === value) ??
												"all",
										)
									}
									className="max-w-full"
								>
									{/* On a phone the tabs wrap to a second line, so no status hides past the edge. */}
									<TabsList className="max-w-full flex-wrap justify-start group-data-[orientation=horizontal]/tabs:h-auto">
										<TabsTrigger value="all">
											{t("timeOff.all")}
											<span className="text-muted-foreground tabular-nums">
												{number.format(ofType.length)}
											</span>
										</TabsTrigger>
										{tabs.map((tab) => (
											<TabsTrigger key={tab.value} value={tab.value}>
												{t(`timeOffStatuses.${tab.value}`)}
												<span className="text-muted-foreground tabular-nums">
													{number.format(tab.count)}
												</span>
											</TabsTrigger>
										))}
									</TabsList>
								</Tabs>
								<Select
									value={type}
									onValueChange={(value) =>
										setType(
											TIME_OFF_TYPES.find((option) => option === value) ??
												"all",
										)
									}
								>
									<SelectTrigger
										className="w-full sm:w-44"
										aria-label={t("timeOff.typeFilter")}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">{t("timeOff.allTypes")}</SelectItem>
										{TIME_OFF_TYPES.map((option) => (
											<SelectItem key={option} value={option}>
												{t(`timeOffTypes.${option}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</>
						}
					/>
				</CardContent>
			</Card>
			<RequestDialog
				request={dialogRequest}
				open={openRequest !== null}
				onOpenChange={(open) => {
					if (!open) {
						setClosingId(requestId ?? null);
						navigate({ search: {}, replace: true });
					}
				}}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6"];

/** Placeholder while the time-off loader runs. The route sets it as pendingComponent. */
export function TimeOffPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-72" />
			</div>
			<KpiFiguresSkeleton count={4} className={KPI_GRID} />
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-5 w-48" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-9 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the page when the loader fails. Try again runs the loader again. */
export function TimeOffPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("timeOff.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
