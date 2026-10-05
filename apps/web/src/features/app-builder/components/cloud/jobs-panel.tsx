/**
 * Jobs panel of the Backend group: the pg_cron jobs of the app with their
 * schedule, active state, and last run. Read only (WANDIT-188). Rendered by
 * cloud-panel-content.tsx inside backend-state.tsx, so the backend is `active` here.
 * Reads cloudJobsQuery.
 */

import { CalendarDotsIcon } from "@phosphor-icons/react/CalendarDots";
import { CalendarSlashIcon } from "@phosphor-icons/react/CalendarSlash";
import { useQuery } from "@tanstack/react-query";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@wandit/ui/components/table";
import { cn } from "@wandit/ui/lib/utils";

import { formatDate, useTranslation } from "@/lib/i18n";
import { cloudJobsQuery } from "../../api/cloud.queries";
import { CLOUD_DATE_TIME_FORMAT, CLOUD_EMPTY_CELL } from "../../lib/constants";
import { PanelChip, PanelMessage } from "../more/panel-shell";
import { CloudLoadFailed } from "./backend-state";
import {
	CLOUD_CELL_MUTED_CLASS,
	CLOUD_TABLE_CLASS,
	RowsGridSkeleton,
} from "./rows-grid";

/** Props of JobsPanel. The panel mounts only while the backend is `active`. */
export type JobsPanelProps = {
	projectId: string;
	/** True while the More view is on screen. The query of the panel waits for it. */
	isActive: boolean;
};

/** One row per pg_cron job. The last run is the newest of the runs the route sends. */
export function JobsPanel({ projectId, isActive }: JobsPanelProps) {
	const { t, locale } = useTranslation();
	const jobs = useQuery(cloudJobsQuery(projectId, isActive));

	if (jobs.isPending) {
		return <RowsGridSkeleton />;
	}
	// A failed refetch keeps the last good list; only a failed first load has no data.
	if (jobs.data === undefined) {
		return <CloudLoadFailed projectId={projectId} />;
	}
	// A new backend has no pg_cron until a migration turns the extension on.
	if (!jobs.data.installed) {
		return (
			<PanelMessage
				icon={CalendarSlashIcon}
				text={t("workspace.cloud.jobs.notInstalled")}
			/>
		);
	}
	if (jobs.data.jobs.length === 0) {
		return (
			<PanelMessage
				icon={CalendarDotsIcon}
				text={t("workspace.cloud.jobs.empty")}
			/>
		);
	}

	return (
		<div className={CLOUD_TABLE_CLASS}>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>{t("workspace.cloud.jobs.columns.name")}</TableHead>
						<TableHead>{t("workspace.cloud.jobs.columns.schedule")}</TableHead>
						<TableHead>{t("workspace.cloud.jobs.columns.active")}</TableHead>
						<TableHead>
							{t("workspace.cloud.jobs.columns.lastStatus")}
						</TableHead>
						<TableHead>{t("workspace.cloud.jobs.columns.lastRunAt")}</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{jobs.data.jobs.map((job) => {
						// The route sends the runs newest first.
						const lastRun = job.runs[0];
						return (
							<TableRow key={job.jobId}>
								<TableCell className="font-medium text-night dark:text-foreground">
									{job.name === null ? (
										t("workspace.cloud.jobs.unnamed", { id: job.jobId })
									) : (
										<span dir="ltr" className="font-mono text-[13px]">
											{job.name}
										</span>
									)}
								</TableCell>
								<TableCell>
									<span
										dir="ltr"
										className="rounded-full bg-night/[0.05] px-2 py-0.5 font-mono text-[12.5px] dark:bg-white/[0.06]"
									>
										{job.schedule}
									</span>
								</TableCell>
								<TableCell>
									<PanelChip tone={job.active ? "success" : "neutral"}>
										{job.active
											? t("workspace.cloud.jobs.yes")
											: t("workspace.cloud.jobs.no")}
									</PanelChip>
								</TableCell>
								<TableCell className={CLOUD_CELL_MUTED_CLASS}>
									{/* pg_cron status text, for example "succeeded". It is a code, so it is not translated. */}
									{lastRun === undefined ? (
										t("workspace.cloud.never")
									) : (
										<span
											className={cn(
												"font-mono text-[12.5px]",
												// pg_cron writes "succeeded" or "failed" when a run ends; any other status is still open.
												lastRun.status === "succeeded" && "text-success-text",
												lastRun.status === "failed" && "text-destructive",
											)}
										>
											{lastRun.status ?? CLOUD_EMPTY_CELL}
										</span>
									)}
								</TableCell>
								<TableCell className={CLOUD_CELL_MUTED_CLASS}>
									{lastRun?.startTime
										? formatDate(
												lastRun.startTime,
												locale,
												CLOUD_DATE_TIME_FORMAT,
											)
										: CLOUD_EMPTY_CELL}
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}
