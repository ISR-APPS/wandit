/**
 * Jobs panel of the Backend group: the pg_cron jobs of the app with their
 * schedule, active state, and last run. Read only (WANDIT-188). Rendered by
 * cloud-panel-content.tsx inside backend-state.tsx, so the backend is `active` here.
 * Reads cloudJobsQuery.
 */

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@wandit/ui/components/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@wandit/ui/components/table";
import { CalendarClock, CalendarOff } from "lucide-react";

import { formatDate, useTranslation } from "@/lib/i18n";
import { cloudJobsQuery } from "../../api/cloud.queries";
import { CLOUD_DATE_TIME_FORMAT, CLOUD_EMPTY_CELL } from "../../lib/constants";
import { CodeMessage } from "../code/code-viewer";
import { CloudLoadFailed } from "./backend-state";
import { RowsGridSkeleton } from "./rows-grid";

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
			<CodeMessage
				icon={CalendarOff}
				text={t("workspace.cloud.jobs.notInstalled")}
			/>
		);
	}
	if (jobs.data.jobs.length === 0) {
		return (
			<CodeMessage
				icon={CalendarClock}
				text={t("workspace.cloud.jobs.empty")}
			/>
		);
	}

	return (
		<div className="rounded-xl border">
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
								<TableCell className="font-medium">
									{job.name === null ? (
										t("workspace.cloud.jobs.unnamed", { id: job.jobId })
									) : (
										<span dir="ltr" className="font-mono text-sm">
											{job.name}
										</span>
									)}
								</TableCell>
								<TableCell>
									<span dir="ltr" className="font-mono text-sm">
										{job.schedule}
									</span>
								</TableCell>
								<TableCell>
									<Badge variant={job.active ? "success" : "outline"}>
										{job.active
											? t("workspace.cloud.jobs.yes")
											: t("workspace.cloud.jobs.no")}
									</Badge>
								</TableCell>
								<TableCell className="text-muted-foreground">
									{/* pg_cron status text, for example "succeeded". It is a code, so it is not translated. */}
									{lastRun === undefined ? (
										t("workspace.cloud.never")
									) : (
										<span className="font-mono text-sm">
											{lastRun.status ?? CLOUD_EMPTY_CELL}
										</span>
									)}
								</TableCell>
								<TableCell className="text-muted-foreground">
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
