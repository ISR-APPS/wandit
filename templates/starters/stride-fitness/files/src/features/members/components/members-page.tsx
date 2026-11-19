// The members list behind login: the title with the export, then the member table with its filter buttons.
// The /app/members route renders it after its loader. The route also uses the skeleton and the error below.
// The plan and visits filters live in the URL (`?plan=`, `?visits=`), so the plans page and the home link to them.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	downloadCsv,
	MEMBER_STATUSES,
	PLAN_IDS,
	PLANS,
	type PlanId,
	toCsv,
} from "~/features/gym";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { RecordFilter } from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { membersQueryOptions } from "../api/members.queries";
import { memberCsvColumns } from "../lib/member-csv";
import { VISIT_FILTERS, type VisitFilter } from "../lib/member-rows";
import { MemberTable } from "./member-table";

type MembersPageProps = {
	/** The `plan` search param. Absent: every plan. */
	planId?: PlanId;
	/** The `visits` search param. Absent: every member. */
	visits?: VisitFilter;
};

// Ten rows, as the kit list page shows. The pages show the rest.
const MEMBERS_PAGE_SIZE = 10;

/** The list page. The status, plan, and visits filters cut the rows; then the table searches, sorts, and pages them. */
export function MembersPage({ planId, visits }: MembersPageProps) {
	const { t } = useT();
	const navigate = useNavigate();
	const { data: members } = useSuspenseQuery(membersQueryOptions());
	const [status, setStatus] = useState<string | null>(null);

	const rows = members.filter(
		(row) =>
			(planId === undefined || row.planId === planId) &&
			(status === null || row.status === status) &&
			(visits === undefined || row.isAtRisk === (visits === "atRisk")),
	);

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("members.title")}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							downloadCsv("members.csv", toCsv(rows, memberCsvColumns(t)))
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				}
			/>
			<MemberTable
				members={rows}
				variant="list"
				pageSize={MEMBERS_PAGE_SIZE}
				noResults={t("members.noResults")}
				toolbar={
					<>
						<RecordFilter
							label={t("members.status")}
							options={MEMBER_STATUSES.map((value) => ({
								value,
								label: t(`memberStatuses.${value}`),
							}))}
							value={status}
							onValueChange={setStatus}
						/>
						<RecordFilter
							label={t("members.plan")}
							options={PLANS.map((plan) => ({
								value: plan.id,
								label: plan.name,
							}))}
							value={planId ?? null}
							onValueChange={(value) =>
								navigate({
									to: "/app/members",
									search: {
										plan: PLAN_IDS.find((id) => id === value),
										visits,
									},
								})
							}
						/>
						<RecordFilter
							label={t("members.visits")}
							options={VISIT_FILTERS.map((value) => ({
								value,
								label: t(`members.visitFilters.${value}`),
							}))}
							value={visits ?? null}
							onValueChange={(value) =>
								navigate({
									to: "/app/members",
									search: {
										plan: planId,
										visits: VISIT_FILTERS.find((filter) => filter === value),
									},
								})
							}
						/>
					</>
				}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Placeholder while the list loader runs. The route sets it as pendingComponent. */
export function MembersPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex items-end justify-between gap-3">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-9 w-full sm:max-w-xl" />
			<div className="grid gap-2 rounded-md border p-3">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-10 w-full" />
				))}
			</div>
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
