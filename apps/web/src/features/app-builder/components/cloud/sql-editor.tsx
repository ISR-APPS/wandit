/**
 * SQL console of the Database panel: a monospace editor card with a Run
 * button in its footer. rows-grid.tsx shows the result. A write statement
 * opens a confirm dialog before it posts. Rendered by database-panel.tsx.
 * Posts through useRunSql. `classifySql` sorts the statements, as on the
 * server.
 */

import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { PlayIcon } from "@phosphor-icons/react/Play";
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
import { cn } from "@wandit/ui/lib/utils";
import { useState } from "react";

import { isApiClientError } from "@/lib/api-client";
import { formatNumber, useTranslation } from "@/lib/i18n";
import { useRunSql } from "../../api/cloud.mutations";
import type { runSql } from "../../api/cloud.services";
import {
	PANEL_CARD_CLASS,
	PANEL_PRIMARY_BUTTON_CLASS,
} from "../more/panel-shell";
import { RowsGrid } from "./rows-grid";

/** Note line under the console: the row count and the row-limit note. */
const SQL_NOTE_CLASS =
	"px-1 font-grotesk text-[13px] text-night/55 tabular-nums dark:text-foreground/55";

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
		<div className="flex min-w-0 flex-col gap-4">
			{/* The editor and its footer are one card. Its ring lights up while the editor has focus. */}
			<div
				className={cn(
					PANEL_CARD_CLASS,
					"overflow-hidden transition-shadow focus-within:border-primary/40 focus-within:ring-[3px] focus-within:ring-primary/15",
				)}
			>
				<Textarea
					dir="ltr"
					aria-label={t("workspace.cloud.database.sql.label")}
					placeholder={t("workspace.cloud.database.sql.placeholder")}
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					spellCheck={false}
					className="min-h-40 resize-y rounded-none border-0 bg-transparent px-4 py-3.5 font-mono text-[13px] leading-relaxed shadow-none placeholder:text-night/35 focus-visible:ring-0 md:text-[13px] dark:bg-transparent dark:placeholder:text-foreground/35"
				/>
				<div className="flex min-h-12 items-center justify-between gap-3 border-night/[0.07] border-t py-1.5 ps-4 pe-1.5 dark:border-white/[0.07]">
					<p className="font-sans text-[13px] text-night/50 leading-snug dark:text-foreground/50">
						{run.isIdle ? t("workspace.cloud.database.sql.hint") : null}
					</p>
					<Button
						className={PANEL_PRIMARY_BUTTON_CLASS}
						onClick={runDraft}
						disabled={run.isPending || draft.trim() === ""}
					>
						{run.isPending ? (
							<CircleNotchIcon
								aria-hidden
								weight="bold"
								className="animate-spin"
							/>
						) : (
							<PlayIcon aria-hidden weight="fill" />
						)}
						{t("workspace.cloud.database.sql.run")}
					</Button>
				</div>
			</div>
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
						className="max-h-40 overflow-auto whitespace-pre-wrap rounded-[14px] bg-night/[0.04] p-3 font-mono text-[12.5px] text-night dark:bg-white/[0.06] dark:text-foreground"
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
				<p className={SQL_NOTE_CLASS}>
					{t("workspace.cloud.database.rowCount", {
						count: result.rowCount,
						countDisplay: formatNumber(result.rowCount, locale),
					})}
				</p>
			) : null}
			{result.truncated ? (
				<p className={SQL_NOTE_CLASS}>
					{t("workspace.cloud.database.sql.truncated", {
						limit: formatNumber(CLOUD_SQL_ROW_LIMIT, locale),
					})}
				</p>
			) : null}
		</div>
	);
}
