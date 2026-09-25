/**
 * SQL console of the Database panel: a monospace textarea, a Run button,
 * and the result in rows-grid.tsx. A write statement opens a confirm dialog
 * before it posts. Rendered by database-panel.tsx. Posts through useRunSql
 * and sorts statements with `classifySql`, the classifier the server runs too.
 */

import {
	CLOUD_SQL_ROW_LIMIT,
	type CloudSqlResponse,
	classifySql,
} from "@wandit/contracts";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@wandit/ui/components/alert-dialog";
import { Button } from "@wandit/ui/components/button";
import { Textarea } from "@wandit/ui/components/textarea";
import { LoaderCircle, Play } from "lucide-react";
import { useState } from "react";

import { isApiClientError } from "@/lib/api-client";
import { formatNumber, useTranslation } from "@/lib/i18n";
import { useRunSql } from "../../api/cloud.mutations";
import type { runSql } from "../../api/cloud.services";
import { RowsGrid } from "./rows-grid";

/** Props of SqlEditor. `postSql` is the one test seam; the database panel passes only the project. */
export type SqlEditorProps = {
	projectId: string;
	/** The SQL POST. The spec passes a fake; the panel omits it, so the hook posts through apiClient. */
	postSql?: typeof runSql;
};

/**
 * The draft stays in the editor after a run. A write opens the confirm
 * dialog, and `confirmWrite: true` goes out only after the user accepts.
 */
export function SqlEditor({ projectId, postSql }: SqlEditorProps) {
	const { t } = useTranslation();
	const [draft, setDraft] = useState("");
	// The statement the confirm dialog shows and sends; null while the dialog is closed.
	const [pendingWrite, setPendingWrite] = useState<string | null>(null);
	const run = useRunSql(projectId, postSql);

	function send(statement: string, confirmWrite: boolean) {
		run.mutate(
			{ query: statement, confirmWrite },
			{
				onError: (error) => {
					// The server sorts the statement again. Its 409 opens the same dialog.
					if (isApiClientError(error) && error.code === "WRITE_NEEDS_CONFIRM") {
						setPendingWrite(statement);
					}
				},
			},
		);
	}

	function runDraft() {
		const statement = draft.trim();
		if (statement === "") return;
		// Product rule: the console asks once before a write. The confirm flag
		// goes out only after the user accepts the dialog.
		if (classifySql(statement) === "write") {
			setPendingWrite(statement);
			return;
		}
		send(statement, false);
	}

	return (
		<div className="flex min-w-0 flex-col gap-3">
			<Textarea
				dir="ltr"
				aria-label={t("workspace.cloud.database.sql.label")}
				placeholder={t("workspace.cloud.database.sql.placeholder")}
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				spellCheck={false}
				className="min-h-40 font-mono text-sm"
			/>
			<div>
				<Button
					size="sm"
					onClick={runDraft}
					disabled={run.isPending || draft.trim() === ""}
				>
					{run.isPending ? <LoaderCircle className="animate-spin" /> : <Play />}
					{t("workspace.cloud.database.sql.run")}
				</Button>
			</div>
			{run.isIdle ? (
				<p className="text-muted-foreground text-sm">
					{t("workspace.cloud.database.sql.hint")}
				</p>
			) : null}
			{run.data ? <SqlResult result={run.data} /> : null}
			<AlertDialog
				open={pendingWrite !== null}
				onOpenChange={(open) => {
					if (!open) setPendingWrite(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("workspace.cloud.database.sql.confirm.title")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("workspace.cloud.database.sql.confirm.description")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<pre
						dir="ltr"
						className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs"
					>
						{pendingWrite}
					</pre>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{t("workspace.cloud.database.sql.confirm.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => {
								if (pendingWrite !== null) send(pendingWrite, true);
							}}
						>
							{t("workspace.cloud.database.sql.confirm.run")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

/** The rows of one answer, its row count, and the row-limit note when the server cut the rows. */
function SqlResult({ result }: { result: CloudSqlResponse }) {
	const { t, locale } = useTranslation();
	const firstRow = result.rows[0];

	return (
		<div className="flex min-w-0 flex-col gap-2">
			<RowsGrid
				// Every row of one result has the same columns.
				columns={firstRow ? Object.keys(firstRow) : []}
				rows={result.rows}
				emptyText={t("workspace.cloud.database.sql.noRows")}
			/>
			{result.rows.length > 0 ? (
				<p className="text-muted-foreground text-sm">
					{t("workspace.cloud.database.rowCount", {
						count: result.rowCount,
						countDisplay: formatNumber(result.rowCount, locale),
					})}
				</p>
			) : null}
			{result.truncated ? (
				<p className="text-muted-foreground text-sm">
					{t("workspace.cloud.database.sql.truncated", {
						limit: formatNumber(CLOUD_SQL_ROW_LIMIT, locale),
					})}
				</p>
			) : null}
		</div>
	);
}
