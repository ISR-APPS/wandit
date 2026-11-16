// The account list behind login: the page header with the plan filter, the health strip, and the searchable table.
// The /app/accounts route renders it after its loader. The route also uses the skeleton and the error below.
// The plan filter drives the strip and the table. The status tabs then filter the rows of the table.
// Under 1024 px the table has two columns, and a Select replaces the status tabs.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	ChangePill,
	fillMessage,
	formatRelativeTime,
	NameMark,
	PLANS,
	type Plan,
	ShareBar,
	shareOf,
	TOUCH_AREA,
	useIsWideScreen,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { type Account, accountsQueryOptions } from "../api/accounts.queries";
import {
	ACCOUNT_STATUS_BADGE,
	ACCOUNT_STATUSES,
	type AccountStatus,
} from "../lib/account-status";
import { AccountHealthStrip } from "./account-health-strip";

/** The columns under 1024 px. The status moves under the name, beside the plan. */
const PHONE_COLUMN_IDS = ["name", "activePeople"];

/** The list page. The plan filter and the status tab cut the rows; then DataTable searches, sorts, and pages them. */
export function AccountsPage() {
	const { t, locale } = useT();
	const isWide = useIsWideScreen();
	const { data: accounts } = useSuspenseQuery(accountsQueryOptions());
	const [plan, setPlan] = useState<Plan | "all">("all");
	const [status, setStatus] = useState<AccountStatus | "all">("all");

	const number = new Intl.NumberFormat(locale);
	const now = Date.now();
	// The query gives the newest account first. This page opens with the account that has the most active users.
	const ofPlan = accounts
		.filter((account) => plan === "all" || account.plan === plan)
		.sort((first, second) => second.activePeople - first.activePeople);
	// A tab shows only for a status that has rows.
	const tabs = ACCOUNT_STATUSES.map((value) => ({
		value,
		count: ofPlan.filter((account) => account.status === value).length,
	})).filter((tab) => tab.count > 0);
	// Another plan can empty the chosen tab. Its tab then disappears, so the list shows all rows.
	const activeStatus = tabs.some((tab) => tab.value === status)
		? status
		: "all";
	const rows =
		activeStatus === "all"
			? ofPlan
			: ofPlan.filter((account) => account.status === activeStatus);

	const columns: DataTableColumn<Account>[] = [
		{
			id: "name",
			header: t("accounts.columns.account"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="flex items-center gap-3">
					<NameMark name={row.name} />
					<div className="grid justify-items-start">
						<Link
							to="/app/accounts/$accountId"
							params={{ accountId: row.id }}
							className={cn(
								"font-medium hover:underline",
								isWide && "whitespace-nowrap",
								TOUCH_AREA,
							)}
						>
							{row.name}
						</Link>
						{isWide ? (
							<span className="whitespace-nowrap text-muted-foreground text-xs">
								{`${t(`plans.${row.plan}`)} · ${row.domain}`}
							</span>
						) : (
							<span className="mt-1 flex items-center gap-2 whitespace-nowrap text-muted-foreground text-xs">
								<Badge variant={ACCOUNT_STATUS_BADGE[row.status]}>
									{t(`accounts.statuses.${row.status}`)}
								</Badge>
								{t(`plans.${row.plan}`)}
							</span>
						)}
					</div>
				</div>
			),
		},
		{
			id: "status",
			header: t("accounts.columns.status"),
			sortValue: (row) => ACCOUNT_STATUSES.indexOf(row.status),
			cell: (row) => (
				<Badge variant={ACCOUNT_STATUS_BADGE[row.status]}>
					{t(`accounts.statuses.${row.status}`)}
				</Badge>
			),
		},
		{
			id: "activePeople",
			header: t("accounts.columns.activePeople"),
			sortValue: (row) => row.activePeople,
			cell: (row) => (
				<div className="grid @2xl/main:w-28 @5xl/main:w-44 w-24 gap-1.5">
					<span className="tabular-nums">
						{number.format(row.activePeople)}{" "}
						<span className="text-muted-foreground">
							{fillMessage(t("accounts.ofPeople"), {
								count: number.format(row.members),
							})}
						</span>
					</span>
					<ShareBar share={shareOf(row.activePeople, row.members)} />
				</div>
			),
		},
		{
			id: "change",
			header: t("accounts.columns.change"),
			// An account with no earlier data sorts below every fall.
			sortValue: (row) => row.change ?? -2,
			cell: (row) =>
				row.change === null ? (
					<span className="text-muted-foreground">
						{t("accounts.noChange")}
					</span>
				) : (
					<ChangePill change={row.change} goodWhen="up" />
				),
		},
		{
			id: "lastSeen",
			header: t("accounts.columns.lastSeen"),
			align: "end",
			sortValue: (row) => (row.lastSeenAt ? Date.parse(row.lastSeenAt) : 0),
			cell: (row) =>
				row.lastSeenAt ? (
					<span className="whitespace-nowrap">
						{formatRelativeTime(row.lastSeenAt, now, locale)}
					</span>
				) : (
					t("accounts.neverSeen")
				),
		},
	];
	const shownColumns = isWide
		? columns
		: columns.filter((column) => PHONE_COLUMN_IDS.includes(column.id));
	const statusOptions = [
		{ value: "all" as const, label: t("accounts.all"), count: ofPlan.length },
		...tabs.map((tab) => ({
			value: tab.value,
			label: t(`accounts.statuses.${tab.value}`),
			count: tab.count,
		})),
	];
	const changeStatus = (value: string) =>
		setStatus(ACCOUNT_STATUSES.find((option) => option === value) ?? "all");

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("accounts.title")}
				description={t("accounts.description")}
				actions={
					<Select
						value={plan}
						onValueChange={(value) =>
							setPlan(PLANS.find((option) => option === value) ?? "all")
						}
					>
						<SelectTrigger
							aria-label={t("accounts.planFilter")}
							className="w-40"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							<SelectItem value="all">{t("accounts.allPlans")}</SelectItem>
							{PLANS.map((option) => (
								<SelectItem key={option} value={option}>
									{t(`plans.${option}`)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				}
			/>
			<AccountHealthStrip accounts={ofPlan} />
			<Card>
				<CardContent>
					<DataTable
						rows={rows}
						columns={shownColumns}
						searchText={(row) => `${row.name} ${row.domain} ${row.industry}`}
						noResults={t("accounts.noResults")}
						toolbar={
							isWide ? (
								<Tabs value={activeStatus} onValueChange={changeStatus}>
									<TabsList aria-label={t("accounts.columns.status")}>
										{statusOptions.map((option) => (
											<TabsTrigger key={option.value} value={option.value}>
												{option.label}
												<span className="text-muted-foreground tabular-nums">
													{number.format(option.count)}
												</span>
											</TabsTrigger>
										))}
									</TabsList>
								</Tabs>
							) : (
								<Select value={activeStatus} onValueChange={changeStatus}>
									<SelectTrigger
										aria-label={t("accounts.columns.status")}
										className="w-full"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{statusOptions.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{`${option.label} · ${number.format(option.count)}`}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)
						}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function AccountsPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<Skeleton className="h-9 w-40" />
			</div>
			<Skeleton className="h-32 w-full" />
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-xs" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the list and of the account page when a loader fails. Try again runs the loader again. */
export function AccountsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("accounts.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
