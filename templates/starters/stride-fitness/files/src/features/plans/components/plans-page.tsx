// The plans page behind login, in the anatomy of the kit products page: the title with the export,
// four KPI cards, then the plan table with its filter buttons, column menu, and row menu.
// The /app/plans route renders it after its loader. The route also uses the skeleton and the error below.
// The active counts of the rows add up to the active members of the home and of the members list.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	copyToClipboard,
	downloadCsv,
	initialsOf,
	moneyFormat,
	PLAN_CURRENCY,
	toCsv,
} from "~/features/gym";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import {
	type RecordColumn,
	RecordFilter,
	RecordTable,
} from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { plansOverviewQueryOptions } from "../api/plans.queries";
import type { PlanRow } from "../lib/plan-summary";
import { PlanKpiCard } from "./plan-kpi-card";

// Ten rows per page, as the kit list page. The gym has 5 plans, so one page holds them all.
const PLANS_PAGE_SIZE = 10;
// The values of the two filter buttons.
const BILLINGS = ["month", "year"] as const;
const ACCESSES = ["all", "off-peak"] as const;

/** The KPI row, then the table. The billing and access filters cut the rows before the table. */
export function PlansPage() {
	const { t, locale } = useT();
	const { data: overview } = useSuspenseQuery(plansOverviewQueryOptions());
	const [billing, setBilling] = useState<string | null>(null);
	const [access, setAccess] = useState<string | null>(null);
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const rows = overview.rows.filter(
		(row) =>
			(billing === null || row.plan.billing === billing) &&
			(access === null || row.plan.access === access),
	);

	const csvColumns = [
		{ header: t("plans.plan"), value: (row: PlanRow) => row.plan.name },
		{
			header: `${t("plans.price")} (${PLAN_CURRENCY})`,
			value: (row: PlanRow) => String(row.plan.price),
		},
		{
			header: t("plans.billing"),
			value: (row: PlanRow) => t(`plans.billings.${row.plan.billing}`),
		},
		{
			header: t("plans.activeMembers"),
			value: (row: PlanRow) => String(row.activeCount),
		},
		{
			header: t("plans.frozenMembers"),
			value: (row: PlanRow) => String(row.frozenCount),
		},
		{
			header: `${t("plans.monthlyValue")} (${PLAN_CURRENCY})`,
			value: (row: PlanRow) => String(Math.round(row.monthlyValue)),
		},
	];

	const columns: RecordColumn<PlanRow>[] = [
		{
			id: "plan",
			header: t("plans.plan"),
			sortValue: (row) => row.plan.name,
			cell: (row) => (
				<div className="flex items-center gap-3">
					<span
						aria-hidden="true"
						className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted font-numeric font-semibold text-sm"
					>
						{initialsOf(row.plan.name)}
					</span>
					<div className="grid min-w-0">
						<span className="font-medium">{row.plan.name}</span>
						{/* The summary wraps in a narrow column, so the full text shows and the row stays short. */}
						<span className="min-w-48 max-w-72 whitespace-normal text-pretty text-muted-foreground text-xs">
							{row.plan.summary}
						</span>
					</div>
				</div>
			),
		},
		{
			id: "price",
			header: t("plans.price"),
			align: "end",
			sortValue: (row) => row.plan.price,
			cell: (row) => money.format(row.plan.price),
		},
		{
			id: "billing",
			header: t("plans.billing"),
			hideable: true,
			sortValue: (row) => row.plan.billing,
			cell: (row) => t(`plans.billings.${row.plan.billing}`),
		},
		{
			id: "classes",
			header: t("plans.classesPerMonth"),
			hideable: true,
			align: "end",
			// No limit sorts after every limit.
			sortValue: (row) => row.plan.classesPerMonth ?? Number.MAX_SAFE_INTEGER,
			cell: (row) =>
				row.plan.classesPerMonth === null
					? t("plans.unlimited")
					: number.format(row.plan.classesPerMonth),
		},
		{
			id: "active",
			header: t("plans.activeMembers"),
			align: "end",
			sortValue: (row) => row.activeCount,
			cell: (row) => number.format(row.activeCount),
		},
		{
			id: "frozen",
			header: t("plans.frozenMembers"),
			hideable: true,
			align: "end",
			sortValue: (row) => row.frozenCount,
			cell: (row) => number.format(row.frozenCount),
		},
		{
			id: "value",
			header: t("plans.monthlyValue"),
			align: "end",
			sortValue: (row) => row.monthlyValue,
			cell: (row) => (
				<span className="font-medium">{money.format(row.monthlyValue)}</span>
			),
		},
		{
			id: "access",
			header: t("plans.access"),
			sortValue: (row) => row.plan.access,
			cell: (row) => (
				<Badge variant={row.plan.access === "all" ? "success" : "info"}>
					{t(`plans.accesses.${row.plan.access}`)}
				</Badge>
			),
		},
	];

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("plans.title")}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							downloadCsv("plans.csv", toCsv(overview.rows, csvColumns))
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				}
			/>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				<PlanKpiCard
					label={t("plans.monthlyRevenue")}
					value={money.format(overview.monthlyRevenue.value)}
					change={overview.monthlyRevenue.change}
					goodWhen="up"
				/>
				<PlanKpiCard
					label={t("plans.payingMembers")}
					value={number.format(overview.payingMembers.value)}
					change={overview.payingMembers.change}
					goodWhen="up"
				/>
				<PlanKpiCard
					label={t("plans.averagePerMember")}
					value={money.format(overview.averagePerMember.value)}
					change={overview.averagePerMember.change}
					goodWhen="up"
				/>
				<PlanKpiCard
					label={t("plans.frozenMembers")}
					value={number.format(overview.frozenMembers.value)}
					change={overview.frozenMembers.change}
					goodWhen="down"
				/>
			</div>
			<RecordTable
				rows={rows}
				columns={columns}
				searchText={(row) => `${row.plan.name} ${row.plan.summary}`}
				searchPlaceholder={t("plans.filterPlaceholder")}
				pageSize={PLANS_PAGE_SIZE}
				noResults={t("plans.noResults")}
				selectable
				toolbar={
					<>
						<RecordFilter
							label={t("plans.billing")}
							options={BILLINGS.map((value) => ({
								value,
								label: t(`plans.billings.${value}`),
							}))}
							value={billing}
							onValueChange={setBilling}
						/>
						<RecordFilter
							label={t("plans.access")}
							options={ACCESSES.map((value) => ({
								value,
								label: t(`plans.accesses.${value}`),
							}))}
							value={access}
							onValueChange={setAccess}
						/>
					</>
				}
				bulkActions={(selectedRows) => (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9"
						onClick={() =>
							downloadCsv("plans-selected.csv", toCsv(selectedRows, csvColumns))
						}
					>
						<DownloadSimpleIcon />
						{t("table.exportSelected")}
					</Button>
				)}
				rowMenu={(row) => (
					<>
						<DropdownMenuItem asChild>
							<Link to="/app/members" search={{ plan: row.id }}>
								{t("plans.viewMembers")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(row.id, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("plans.copyId")}
						</DropdownMenuItem>
					</>
				)}
			/>
		</div>
	);
}

// Placeholder keys of the KPI row and the table rows. Fixed keys, because they never reorder.
const SKELETON_KPIS = ["1", "2", "3", "4"];
const SKELETON_ROWS = ["1", "2", "3", "4", "5"];

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function PlansPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-end justify-between gap-3">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-9 w-32" />
			</div>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{SKELETON_KPIS.map((key) => (
					<Skeleton key={key} className="h-28" />
				))}
			</div>
			<div className="grid gap-2 rounded-md border p-3">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-12 w-full" />
				))}
			</div>
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
export function PlansPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("plans.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
