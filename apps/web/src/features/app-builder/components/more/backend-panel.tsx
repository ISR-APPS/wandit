/**
 * Backend panel: three stat cards, the table list, and the server function
 * list of the generated backend. Reads backendSummaryQuery and suspends
 * until the summary is loaded.
 * Rendered by components/more/more-view.tsx inside PanelShell.
 */

import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@wandit/ui/components/button";
import { toast } from "sonner";

import { formatNumber, useTranslation } from "@/lib/i18n";
import { backendSummaryQuery } from "../../api/app-builder.queries";

export type BackendPanelProps = {
	projectId: string;
};

export function BackendPanel({ projectId }: BackendPanelProps) {
	const { t, locale } = useTranslation();
	const { data } = useSuspenseQuery(backendSummaryQuery(projectId));

	return (
		<>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<StatCard
					label={t("appBuilder.backend.database")}
					value={t("appBuilder.backend.tableCount", {
						count: data.tables.length,
					})}
					sub={t("appBuilder.backend.databaseNote", {
						rows: formatNumber(data.rowCount, locale),
						size: formatNumber(data.sizeMb, locale),
					})}
				/>
				<StatCard
					label={t("appBuilder.backend.storage")}
					value={t("appBuilder.backend.storageSize", {
						size: formatNumber(data.storageGb, locale),
					})}
					sub={data.storageNote}
				/>
				<StatCard
					label={t("appBuilder.backend.functions")}
					value={formatNumber(data.functions.length, locale)}
					sub={t("appBuilder.backend.callsToday", {
						count: formatNumber(data.functionCallsToday, locale),
					})}
				/>
			</div>

			<section className="rounded-2xl border bg-card">
				<div className="flex items-center justify-between gap-3 px-4 py-3">
					<h2 className="font-semibold">
						{t("appBuilder.backend.tablesTitle")}
					</h2>
					<Button
						variant="outline"
						size="sm"
						onClick={() => toast(t("appBuilder.mock.notWired"))}
					>
						{t("appBuilder.backend.openSql")}
					</Button>
				</div>
				{data.tables.map((table) => (
					<div
						key={table.name}
						className="grid grid-cols-[140px_1fr_auto] items-center gap-4 border-t px-4 py-3 text-sm"
					>
						<span className="truncate font-mono">{table.name}</span>
						<span className="truncate text-muted-foreground">
							{table.columns.join(" · ")}
						</span>
						<span className="text-muted-foreground">
							{t("appBuilder.backend.rowCount", {
								count: table.rowCount,
								countDisplay: formatNumber(table.rowCount, locale),
							})}
						</span>
					</div>
				))}
			</section>

			<section className="rounded-2xl border bg-card">
				<h2 className="px-4 py-3 font-semibold">
					{t("appBuilder.backend.functionsTitle")}
				</h2>
				{data.functions.map((serverFunction) => (
					<div
						key={serverFunction.name}
						className="flex items-center gap-3 border-t px-4 py-3 text-sm"
					>
						<span
							aria-hidden="true"
							className="size-1.5 shrink-0 rounded-full bg-success"
						/>
						<span className="min-w-0 flex-1 truncate font-mono">
							{serverFunction.name}
						</span>
						<span dir="auto" className="truncate text-muted-foreground">
							{serverFunction.trigger}
						</span>
						<span className="shrink-0 text-muted-foreground">
							{t("appBuilder.backend.today", {
								count: formatNumber(serverFunction.callsToday, locale),
							})}
						</span>
					</div>
				))}
			</section>
		</>
	);
}

/** One of the three numbers at the top of the panel. `sub` is the small line under the value. */
function StatCard({
	label,
	value,
	sub,
}: {
	label: string;
	value: string;
	sub: string;
}) {
	return (
		<div className="rounded-2xl border bg-card p-4">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="mt-1 font-semibold text-2xl">{value}</p>
			<p dir="auto" className="mt-1 text-muted-foreground text-xs">
				{sub}
			</p>
		</div>
	);
}
