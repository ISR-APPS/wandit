/**
 * Users panel of the Backend group: the sign-ups chart of the last 30 days and
 * the paged list of the `auth.users` rows of the app. Rendered by
 * cloud-panel-content.tsx inside backend-state.tsx, so the backend is `active` here.
 * Reads cloudSignupsQuery and cloudAuthUsersQuery; renders signups-chart.tsx.
 */

import { UserIcon } from "@phosphor-icons/react/User";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@wandit/ui/components/table";
import { cn } from "@wandit/ui/lib/utils";
import { useState } from "react";

import { formatDate, formatNumber, useTranslation } from "@/lib/i18n";
import {
	cloudAuthUsersQuery,
	cloudSignupsQuery,
} from "../../api/cloud.queries";
import {
	CLOUD_DATE_TIME_FORMAT,
	CLOUD_EMPTY_CELL,
	CLOUD_ROWS_PAGE_SIZE,
} from "../../lib/constants";
import { PANEL_CARD_CLASS, PanelChip, PanelMessage } from "../more/panel-shell";
import { CloudLoadFailed } from "./backend-state";
import {
	CLOUD_CELL_MUTED_CLASS,
	CLOUD_TABLE_CLASS,
	PageControls,
	RowsGridSkeleton,
} from "./rows-grid";
import { SignupsChart } from "./signups-chart";

/** Props of UsersPanel. The panel mounts only while the backend is `active`. */
export type UsersPanelProps = {
	projectId: string;
	/** True while the More view is on screen. The queries of the panel wait for it. */
	isActive: boolean;
};

/** The sign-ups of 30 days above the users of the app, newest first, 50 per page. */
export function UsersPanel({ projectId, isActive }: UsersPanelProps) {
	const { t, locale } = useTranslation();
	const [page, setPage] = useState(1);
	const signups = useQuery(cloudSignupsQuery(projectId, isActive));
	const users = useQuery({
		...cloudAuthUsersQuery(
			projectId,
			{ page, pageSize: CLOUD_ROWS_PAGE_SIZE },
			isActive,
		),
		// The old page stays on screen while the next page loads.
		placeholderData: keepPreviousData,
	});
	// A user can be deleted while the list is open. A page past the new end moves to the last page.
	const lastPage = users.data
		? Math.max(1, Math.ceil(users.data.total / CLOUD_ROWS_PAGE_SIZE))
		: page;
	if (!users.isPlaceholderData && page > lastPage) {
		setPage(lastPage);
	}

	if (signups.isPending || users.isPending) {
		return <RowsGridSkeleton />;
	}
	// A failed refetch keeps the last good data; only a failed first load has none.
	if (signups.data === undefined || users.data === undefined) {
		return <CloudLoadFailed projectId={projectId} />;
	}

	const signupTotal = signups.data.reduce((sum, day) => sum + day.count, 0);

	return (
		<div className="flex min-w-0 flex-col gap-8">
			<section className={cn(PANEL_CARD_CLASS, "flex flex-col gap-4 p-5")}>
				<div className="flex items-center justify-between gap-3">
					<h2 className="font-grotesk font-semibold text-[15px] text-night dark:text-foreground">
						{t("workspace.cloud.users.signups.title")}
					</h2>
					<PanelChip tone="ember" className="tabular-nums">
						{t("workspace.cloud.users.signups.total", {
							count: signupTotal,
							countDisplay: formatNumber(signupTotal, locale),
						})}
					</PanelChip>
				</div>
				<SignupsChart days={signups.data} />
			</section>
			<section className="flex min-w-0 flex-col gap-3">
				<h2 className="px-1 font-grotesk font-semibold text-[15px] text-night dark:text-foreground">
					{t("workspace.cloud.users.title")}
				</h2>
				{users.data.items.length === 0 ? (
					<PanelMessage
						icon={UserIcon}
						text={t("workspace.cloud.users.empty")}
					/>
				) : (
					<div
						aria-busy={users.isPlaceholderData}
						className={cn(
							CLOUD_TABLE_CLASS,
							"transition-opacity",
							users.isPlaceholderData && "opacity-60",
						)}
					>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>
										{t("workspace.cloud.users.columns.email")}
									</TableHead>
									<TableHead>
										{t("workspace.cloud.users.columns.phone")}
									</TableHead>
									<TableHead>
										{t("workspace.cloud.users.columns.provider")}
									</TableHead>
									<TableHead>
										{t("workspace.cloud.users.columns.createdAt")}
									</TableHead>
									<TableHead>
										{t("workspace.cloud.users.columns.lastSignInAt")}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{users.data.items.map((user) => (
									<TableRow key={user.id}>
										<TableCell className="max-w-64 truncate font-medium text-night dark:text-foreground">
											<span dir="ltr">{user.email ?? CLOUD_EMPTY_CELL}</span>
										</TableCell>
										<TableCell className="font-mono text-[12.5px]">
											<span dir="ltr">{user.phone ?? CLOUD_EMPTY_CELL}</span>
										</TableCell>
										<TableCell>
											{/* The provider is a Supabase code, for example "email". It is not translated. */}
											{user.provider === null ? (
												CLOUD_EMPTY_CELL
											) : (
												<PanelChip className="font-mono">
													{user.provider}
												</PanelChip>
											)}
										</TableCell>
										<TableCell className={CLOUD_CELL_MUTED_CLASS}>
											{formatDate(
												user.createdAt,
												locale,
												CLOUD_DATE_TIME_FORMAT,
											)}
										</TableCell>
										<TableCell className={CLOUD_CELL_MUTED_CLASS}>
											{user.lastSignInAt === null
												? t("workspace.cloud.never")
												: formatDate(
														user.lastSignInAt,
														locale,
														CLOUD_DATE_TIME_FORMAT,
													)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
				{users.data.total > 0 ? (
					<PageControls
						page={page}
						pageSize={CLOUD_ROWS_PAGE_SIZE}
						total={users.data.total}
						onPageChange={setPage}
						countText={t("workspace.cloud.users.count", {
							count: users.data.total,
							countDisplay: formatNumber(users.data.total, locale),
						})}
					/>
				) : null}
			</section>
		</div>
	);
}
