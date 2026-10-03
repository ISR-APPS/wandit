/**
 * Functions panel of the Cloud tab: the Edge Functions of the app with their
 * status, last deploy, calls of the last 24 hours, and a link to their logs.
 * Rendered by cloud-tab.tsx inside backend-state.tsx, so the backend is
 * `active` here. Reads cloudFunctionsQuery.
 */

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@wandit/ui/components/table";
import { ScrollText, SquareFunction } from "lucide-react";

import { formatDate, formatNumber, useTranslation } from "@/lib/i18n";
import { cloudFunctionsQuery } from "../../api/cloud.queries";
import { CLOUD_DATE_TIME_FORMAT } from "../../lib/constants";
import { CodeMessage } from "../code/code-viewer";
import { CloudLoadFailed } from "./backend-state";
import { RowsGridSkeleton } from "./rows-grid";

/** Props of FunctionsPanel. The panel mounts only while the backend is `active`. */
export type FunctionsPanelProps = {
	projectId: string;
	/** True while the Cloud view is on screen. The query of the panel waits for it. */
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
			<CodeMessage
				icon={SquareFunction}
				text={t("workspace.cloud.functions.empty")}
			/>
		);
	}

	return (
		<div className="rounded-xl border">
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
								<span dir="ltr" className="font-medium font-mono text-sm">
									{fn.slug}
								</span>
							</TableCell>
							<TableCell>
								{/* Supabase status text, for example ACTIVE. It is a code, so it is not translated. */}
								<Badge variant="outline" className="font-mono">
									{fn.status}
								</Badge>
							</TableCell>
							<TableCell className="text-muted-foreground">
								{formatDate(fn.lastDeployedAt, locale, CLOUD_DATE_TIME_FORMAT)}
							</TableCell>
							<TableCell className="text-end text-muted-foreground">
								{formatNumber(fn.invocations24h, locale)}
							</TableCell>
							<TableCell className="text-end">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => onViewLogs(fn.slug)}
								>
									<ScrollText />
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
