// The members list behind login: the page header, the status tabs, the plan filter, and the searchable table.
// The /app/members route renders it after its loader. The route also uses the skeleton and the error below.
// The plan filter lives in the URL (`?plan=`), so a plan card of the plans page links to its members.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	formatRelativeTime,
	MEMBER_STATUSES,
	MemberAvatar,
	type MemberStatus,
	MemberStatusBadge,
	PLAN_IDS,
	PLANS,
	type PlanId,
	useNow,
} from "~/features/gym";
import { useT } from "~/shared/i18n";
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
import { membersQueryOptions } from "../api/members.queries";
import type { MemberRow } from "../lib/member-rows";

type MembersPageProps = {
	/** The `plan` search param. Absent: every plan. */
	planId?: PlanId;
};

// The value of the plan Select that shows every plan.
const ALL_PLANS = "all";

/** The list page. The plan filter and the status tab filter the rows; then DataTable searches, sorts, and pages. */
export function MembersPage({ planId }: MembersPageProps) {
	const { t, locale } = useT();
	const now = useNow();
	const navigate = useNavigate();
	const { data: members } = useSuspenseQuery(membersQueryOptions());
	const [status, setStatus] = useState<MemberStatus | "all">("all");

	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const ofPlan = planId
		? members.filter((row) => row.planId === planId)
		: members;
	// A tab shows only for a status that has rows in the chosen plan.
	const tabs = MEMBER_STATUSES.map((value) => ({
		value,
		count: ofPlan.filter((row) => row.status === value).length,
	})).filter((tab) => tab.count > 0);
	// A new plan filter can empty the chosen tab. Its tab then disappears, so the list shows all rows.
	const activeStatus = tabs.some((tab) => tab.value === status)
		? status
		: "all";
	const rows =
		activeStatus === "all"
			? ofPlan
			: ofPlan.filter((row) => row.status === activeStatus);

	const columns: DataTableColumn<MemberRow>[] = [
		{
			id: "member",
			header: t("members.member"),
			sortValue: (row) => row.fullName,
			cell: (row) => (
				<div className="flex items-center gap-3">
					<MemberAvatar name={row.fullName} />
					<div className="grid min-w-0 justify-items-start">
						<Link
							to="/app/members/$memberId"
							params={{ memberId: row.id }}
							className="font-medium hover:underline"
						>
							{row.fullName}
						</Link>
						<span className="whitespace-nowrap text-muted-foreground text-xs">
							{`${t("members.joined")} ${date.format(row.joinedAt)}`}
						</span>
						{/* A narrow page scrolls the status column out of view, so the badge also sits here. */}
						<MemberStatusBadge
							status={row.status}
							className="mt-1.5 @2xl/main:hidden"
						/>
					</div>
				</div>
			),
		},
		{
			id: "plan",
			header: t("members.plan"),
			sortValue: (row) => PLAN_IDS.indexOf(row.planId),
			// The plan name wraps on a phone. The next column then shows in part, and the table reads as scrollable.
			cell: (row) => <span className="whitespace-normal">{row.planName}</span>,
		},
		{
			id: "last-visit",
			header: t("members.lastVisit"),
			sortValue: (row) => row.lastVisitAt ?? 0,
			cell: (row) => (
				<span className="whitespace-nowrap">
					{row.lastVisitAt === null
						? t("members.noVisit")
						: formatRelativeTime(row.lastVisitAt, now, locale)}
				</span>
			),
		},
		{
			id: "visits",
			header: t("members.visits30"),
			align: "end",
			sortValue: (row) => row.visitsInWindow,
			cell: (row) => number.format(row.visitsInWindow),
		},
		// Status comes last: a phone already shows the badge under the name, and the table cuts the end columns.
		{
			id: "status",
			header: t("members.status"),
			sortValue: (row) => MEMBER_STATUSES.indexOf(row.status),
			cell: (row) => <MemberStatusBadge status={row.status} />,
		},
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("members.title")}
				description={t("members.description")}
			/>
			<Card>
				<CardContent>
					<DataTable
						rows={rows}
						columns={columns}
						searchText={(row) => `${row.fullName} ${row.email}`}
						noResults={t("members.noResults")}
						toolbar={
							<>
								<Tabs
									value={activeStatus}
									onValueChange={(value) =>
										setStatus(
											MEMBER_STATUSES.find((option) => option === value) ??
												"all",
										)
									}
									className="@md/main:w-auto w-full max-w-full"
								>
									{/* A phone shows the tabs in two columns, so no count hides at the card edge. Each tab is 44 px high for touch. */}
									<TabsList className="@md/main:flex grid @md/main:w-fit w-full grid-cols-2 @md/main:flex-wrap group-data-[orientation=horizontal]/tabs:h-auto">
										<TabsTrigger
											value="all"
											className="@md/main:min-h-7.5 min-h-11"
										>
											{t("members.all")}
											<span className="rounded-badge bg-background px-1.5 text-foreground text-xs tabular-nums">
												{number.format(ofPlan.length)}
											</span>
										</TabsTrigger>
										{tabs.map((tab) => (
											<TabsTrigger
												key={tab.value}
												value={tab.value}
												className="@md/main:min-h-7.5 min-h-11"
											>
												{t(`memberStatuses.${tab.value}`)}
												<span className="rounded-badge bg-background px-1.5 text-foreground text-xs tabular-nums">
													{number.format(tab.count)}
												</span>
											</TabsTrigger>
										))}
									</TabsList>
								</Tabs>
								<Select
									value={planId ?? ALL_PLANS}
									onValueChange={(value) =>
										navigate({
											to: "/app/members",
											search: {
												plan: PLAN_IDS.find((option) => option === value),
											},
											replace: true,
										})
									}
								>
									<SelectTrigger
										className="w-44"
										aria-label={t("members.plan")}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ALL_PLANS}>
											{t("members.allPlans")}
										</SelectItem>
										{PLANS.map((plan) => (
											<SelectItem key={plan.id} value={plan.id}>
												{plan.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</>
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
export function MembersPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-64" />
			</div>
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-9 w-full sm:max-w-xl" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-12 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the members pages when a loader fails. Try again runs the loader again. */
export function MembersPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("members.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
