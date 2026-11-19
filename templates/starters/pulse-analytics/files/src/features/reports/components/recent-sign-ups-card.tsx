// The recent sign-ups card of the Reports page, in the anatomy of the kit payments table card: a filter
// field, a selectable table of four columns with a status badge and a row menu, and pages of 8 rows.
// ReportsPage renders it at 2 of 3 columns, before the schedule form.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	copyToClipboard,
	downloadCsv,
	fillMessage,
	toCsv,
} from "~/features/tracking";
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
import { DropdownMenuItem } from "~/shared/ui/dropdown-menu";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";
import type { SignUp } from "../api/reports.queries";
import { SIGN_UP_STATUS_BADGE, SIGN_UP_STATUSES } from "../lib/sign-up-status";

// The kit card shows 8 rows per page.
const PAGE_SIZE = 8;

type RecentSignUpsCardProps = {
	/** The new users of the period, the newest first. */
	signUps: SignUp[];
	/** The period in words, for example "30 days". */
	period: string;
};

/** The account cell links to the account page. "Export selected" downloads the checked rows as CSV. */
export function RecentSignUpsCard({ signUps, period }: RecentSignUpsCardProps) {
	const { t } = useT();
	// Four columns, as the kit payments table. The rows come newest first; the CSV keeps the join time.
	const columns: RecordColumn<SignUp>[] = [
		{
			id: "name",
			header: t("reports.recent.columns.user"),
			cell: (row) => <span className="font-medium">{row.name}</span>,
			sortValue: (row) => row.name,
		},
		{
			id: "email",
			header: t("reports.recent.columns.email"),
			cell: (row) => row.email,
			sortValue: (row) => row.email,
			hideable: true,
		},
		{
			id: "account",
			header: t("reports.recent.columns.account"),
			cell: (row) => (
				<Link
					to="/app/accounts/$accountId"
					params={{ accountId: row.accountId }}
					className="hover:underline"
				>
					{row.accountName}
				</Link>
			),
			sortValue: (row) => row.accountName,
			hideable: true,
		},
		{
			id: "status",
			header: t("reports.recent.columns.status"),
			cell: (row) => (
				<Badge variant={SIGN_UP_STATUS_BADGE[row.status]}>
					{t(`reports.statuses.${row.status}`)}
				</Badge>
			),
			sortValue: (row) => SIGN_UP_STATUSES.indexOf(row.status),
			hideable: true,
		},
	];

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("reports.recent.title")}</CardTitle>
				<CardDescription>
					{fillMessage(t("reports.recent.description"), { period })}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<RecordTable
					rows={signUps}
					columns={columns}
					searchText={(row) => `${row.name} ${row.email} ${row.accountName}`}
					searchPlaceholder={t("reports.recent.search")}
					rowMenu={(row) => (
						<>
							<DropdownMenuItem asChild>
								<Link
									to="/app/accounts/$accountId"
									params={{ accountId: row.accountId }}
								>
									{t("reports.recent.openAccount")}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() =>
									copyToClipboard(row.email, {
										done: t("table.copied"),
										failed: t("table.copyFailed"),
									})
								}
							>
								{t("reports.recent.copyEmail")}
							</DropdownMenuItem>
						</>
					)}
					selectable
					bulkActions={(selected) => (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-9"
							onClick={() =>
								downloadCsv(
									"sign-ups-selected.csv",
									toCsv(selected, [
										{
											header: t("reports.recent.columns.user"),
											value: (row) => row.name,
										},
										{
											header: t("reports.recent.columns.email"),
											value: (row) => row.email,
										},
										{
											header: t("reports.recent.columns.account"),
											value: (row) => row.accountName,
										},
										{
											header: t("reports.recent.columns.channel"),
											value: (row) => t(`channels.${row.channel}`),
										},
										{
											header: t("reports.recent.columns.status"),
											value: (row) => t(`reports.statuses.${row.status}`),
										},
										{
											header: t("reports.recent.columns.joined"),
											value: (row) => row.joinedAt,
										},
									]),
								)
							}
						>
							<DownloadSimpleIcon />
							{t("table.exportSelected")}
						</Button>
					)}
					pageSize={PAGE_SIZE}
					noResults={t("reports.recent.noResults")}
				/>
			</CardContent>
		</Card>
	);
}
