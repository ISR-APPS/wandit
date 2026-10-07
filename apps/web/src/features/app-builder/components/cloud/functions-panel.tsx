/**
 * Functions panel of the Backend group: the Edge Functions of the app with their
 * status, last deploy, calls of the last 24 hours, and a link to their logs.
 * Rendered by cloud-panel-content.tsx inside backend-state.tsx, so the backend is
 * `active` here. Reads cloudFunctionsQuery.
 */

import { FunctionIcon } from "@phosphor-icons/react/Function";
import { ScrollIcon } from "@phosphor-icons/react/Scroll";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@wandit/ui/components/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@wandit/ui/components/table";

import { formatDate, formatNumber, useTranslation } from "@/lib/i18n";
import { cloudFunctionsQuery } from "../../api/cloud.queries";
import { CLOUD_DATE_TIME_FORMAT } from "../../lib/constants";
import {
	PANEL_SECONDARY_BUTTON_CLASS,
	PanelChip,
	PanelMessage,
} from "../more/panel-shell";
import { CloudLoadFailed } from "./backend-state";
import {
	CLOUD_CELL_MUTED_CLASS,
	CLOUD_TABLE_CLASS,
	RowsGridSkeleton,
} from "./rows-grid";

/** Props of FunctionsPanel. The panel mounts only while the backend is `active`. */
export type FunctionsPanelProps = {
	projectId: string;
	/** True while the More view is on screen. The query of the panel waits for it. */
	isActive: boolean;
	/** Opens the Logs panel on the `functions` source, filtered on this function slug. */
	onViewLogs: (slug: string) => void;
};

/** One row per Edge Function, in the order Supabase lists them. */
export function FunctionsPanel({
	projectId,
	isActive,
	onViewLogs,
}: FunctionsPanelProps) {
	const { t, locale } = useTranslation();
	const functions = useQuery(cloudFunctionsQuery(projectId, isActive));

	if (functions.isPending) {
		return <RowsGridSkeleton />;
	}
	// A failed refetch keeps the last good list; only a failed first load has no data.
	if (functions.data === undefined) {
		return <CloudLoadFailed projectId={projectId} />;
	}
	if (functions.data.length === 0) {
		return (
			<PanelMessage
				icon={FunctionIcon}
				text={t("workspace.cloud.functions.empty")}
			/>
		);
	}

	return (
		<div className={CLOUD_TABLE_CLASS}>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>{t("workspace.cloud.functions.columns.name")}</TableHead>
						<TableHead>
							{t("workspace.cloud.functions.columns.status")}
						</TableHead>
						<TableHead>
							{t("workspace.cloud.functions.columns.lastDeployedAt")}
						</TableHead>
						<TableHead className="text-end">
							{t("workspace.cloud.functions.columns.invocations")}
						</TableHead>
						<TableHead />
					</TableRow>
				</TableHeader>
				<TableBody>
					{functions.data.map((fn) => (
						<TableRow key={fn.id}>
							<TableCell>
								<span
									dir="ltr"
									className="font-medium font-mono text-[13px] text-night dark:text-foreground"
								>
									{fn.slug}
								</span>
							</TableCell>
							<TableCell>
								{/* Supabase status text, for example ACTIVE. It is a code, so it is not translated. A live function is ACTIVE, so only that code is green. */}
								<PanelChip
									tone={fn.status === "ACTIVE" ? "success" : "neutral"}
									className="font-mono"
								>
									{fn.status}
								</PanelChip>
							</TableCell>
							<TableCell className={CLOUD_CELL_MUTED_CLASS}>
								{formatDate(fn.lastDeployedAt, locale, CLOUD_DATE_TIME_FORMAT)}
							</TableCell>
							<TableCell className="text-end font-grotesk font-medium text-night tabular-nums dark:text-foreground">
								{formatNumber(fn.invocations24h, locale)}
							</TableCell>
							<TableCell className="text-end">
								<Button
									variant="outline"
									size="sm"
									className={PANEL_SECONDARY_BUTTON_CLASS}
									onClick={() => onViewLogs(fn.slug)}
								>
									<ScrollIcon aria-hidden weight="bold" />
									{t("workspace.cloud.functions.viewLogs")}
								</Button>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
