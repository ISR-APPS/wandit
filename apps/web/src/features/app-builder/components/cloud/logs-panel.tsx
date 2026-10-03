/**
 * Logs panel of the Backend group: the log lines of one source (API, Postgres,
 * or Functions) in a 24-hour window, with a level filter, a text search, and
 * the previous and next windows. It never polls: Refresh reads the newest
 * window. Rendered by cloud-panel-content.tsx inside backend-state.tsx, so the backend
 * is `active` here. Reads cloudLogsQuery.
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
	CLOUD_LOGS_MAX_WINDOW_MS,
	CLOUD_LOGS_PAGE_SIZE,
	type CloudLogLevel,
	type CloudLogSource,
	type CloudLogsQuery,
	cloudLogLevels,
	cloudLogSources,
} from "@wandit/contracts";
import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@wandit/ui/components/select";
import { Tabs, TabsList, TabsTrigger } from "@wandit/ui/components/tabs";
import { cn } from "@wandit/ui/lib/utils";
import {
	ChevronLeft,
	ChevronRight,
	RefreshCw,
	ScrollText,
	Search,
} from "lucide-react";
import { useState } from "react";

import { formatDate, formatNumber, useTranslation } from "@/lib/i18n";
import { cloudLogsQuery } from "../../api/cloud.queries";
import { CLOUD_DATE_TIME_FORMAT } from "../../lib/constants";
import { CodeMessage } from "../code/code-viewer";
import { CloudLoadFailed } from "./backend-state";
import { RowsGridSkeleton } from "./rows-grid";

/** The source and the search the panel opens with. */
export type LogsFilter = {
	source: CloudLogSource;
	/** Text the log messages must contain; "" shows every line. */
	search: string;
};

/** Props of LogsPanel. The panel mounts only while the backend is `active`. */
export type LogsPanelProps = {
	projectId: string;
	/** True while the More view is on screen. The query of the panel waits for it. */
	isActive: boolean;
	/** The filter to open with. The Functions panel passes the `functions` source and a function slug. */
	initialFilter?: LogsFilter;
};

/** The level select value that sends no level filter. */
const ALL_LEVELS = "all";
const LEVEL_OPTIONS = [ALL_LEVELS, ...cloudLogLevels] as const;

// The logs route accepts a search of at most 200 characters (cloudLogsQuerySchema).
const SEARCH_MAX_LENGTH = 200;

/** Badge look of each level. The text label keeps the level readable without the color. */
const LEVEL_BADGE = {
	info: "outline",
	warning: "warning",
	error: "destructive",
} as const satisfies Record<
	CloudLogLevel,
	"outline" | "warning" | "destructive"
>;

/** The time line of one source, one 24-hour window at a time, newest line first. */
export function LogsPanel({
	projectId,
	isActive,
	initialFilter,
}: LogsPanelProps) {
	const { t, locale } = useTranslation();
	const [source, setSource] = useState<CloudLogSource>(
		initialFilter?.source ?? "api",
	);
	const [level, setLevel] =
		useState<(typeof LEVEL_OPTIONS)[number]>(ALL_LEVELS);
	// The search applies on submit, so the panel sends no request per key.
	const [searchDraft, setSearchDraft] = useState(initialFilter?.search ?? "");
	const [search, setSearch] = useState(initialFilter?.search ?? "");
	// End of the newest window, ms since epoch. It moves only on Refresh, so the panel never polls.
	const [newestEndMs, setNewestEndMs] = useState(() => Date.now());
	// End of the window on screen. Each window spans the widest the route accepts: 24 hours.
	const [windowEndMs, setWindowEndMs] = useState(newestEndMs);
	const windowStartMs = windowEndMs - CLOUD_LOGS_MAX_WINDOW_MS;
	const query: CloudLogsQuery = {
		source,
		start: new Date(windowStartMs).toISOString(),
		end: new Date(windowEndMs).toISOString(),
		level: level === ALL_LEVELS ? undefined : level,
		search: search === "" ? undefined : search,
	};
	const logs = useQuery({
		...cloudLogsQuery(projectId, query, isActive),
		// The old lines stay on screen, dimmed, while the next window or filter loads.
		placeholderData: keepPreviousData,
	});

	function refresh() {
		const now = Date.now();
		setNewestEndMs(now);
		setWindowEndMs(now);
	}

	function renderLines() {
		if (logs.isPending) {
			return <RowsGridSkeleton />;
		}
		// A failed refetch keeps the last good lines; only a failed first load has no data.
		if (logs.data === undefined) {
			return <CloudLoadFailed projectId={projectId} />;
		}
		if (logs.data.length === 0) {
			return (
				<CodeMessage icon={ScrollText} text={t("workspace.cloud.logs.empty")} />
			);
		}
		return (
			<div className="flex min-w-0 flex-col gap-2">
				{/* Log lines read left to right in every locale. Long lines wrap inside the panel. */}
				<ol
					dir="ltr"
					aria-busy={logs.isPlaceholderData}
					className={cn(
						"divide-y overflow-x-auto rounded-xl border font-mono text-xs transition-opacity",
						logs.isPlaceholderData && "opacity-60",
					)}
				>
					{logs.data.map((entry) => (
						<li key={entry.id} className="flex items-start gap-3 px-3 py-2">
							<time
								dateTime={entry.timestamp}
								className="shrink-0 text-muted-foreground"
							>
								{formatDate(entry.timestamp, locale, CLOUD_DATE_TIME_FORMAT)}
							</time>
							<Badge variant={LEVEL_BADGE[entry.level]} className="shrink-0">
								{t(`workspace.cloud.logs.levels.${entry.level}`)}
							</Badge>
							<span className="min-w-0 whitespace-pre-wrap break-all">
								{entry.message}
							</span>
						</li>
					))}
				</ol>
				{/* The route answers at most 100 lines, so a full page can hide older lines of the window. */}
				{logs.data.length >= CLOUD_LOGS_PAGE_SIZE ? (
					<p className="text-muted-foreground text-sm">
						{t("workspace.cloud.logs.capped", {
							limit: formatNumber(CLOUD_LOGS_PAGE_SIZE, locale),
						})}
					</p>
				) : null}
			</div>
		);
	}

	return (
		<div className="flex min-w-0 flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<Tabs
					value={source}
					onValueChange={(value) => {
						const next = cloudLogSources.find((item) => item === value);
						if (next) setSource(next);
					}}
				>
					<TabsList>
						{cloudLogSources.map((item) => (
							<TabsTrigger key={item} value={item}>
								{t(`workspace.cloud.logs.sources.${item}`)}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				<Select
					value={level}
					onValueChange={(value) => {
						const next = LEVEL_OPTIONS.find((item) => item === value);
						if (next) setLevel(next);
					}}
				>
					<SelectTrigger
						size="sm"
						aria-label={t("workspace.cloud.logs.levelLabel")}
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{LEVEL_OPTIONS.map((item) => (
							<SelectItem key={item} value={item}>
								{t(`workspace.cloud.logs.levels.${item}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<form
					className="flex min-w-48 flex-1 items-center gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						setSearch(searchDraft.trim());
					}}
				>
					<Input
						type="search"
						dir="ltr"
						value={searchDraft}
						maxLength={SEARCH_MAX_LENGTH}
						onChange={(event) => setSearchDraft(event.target.value)}
						aria-label={t("workspace.cloud.logs.searchLabel")}
						className="h-8 font-mono text-sm"
					/>
					<Button type="submit" variant="outline" size="sm">
						<Search />
						{t("workspace.cloud.logs.search")}
					</Button>
				</form>
				<Button variant="outline" size="sm" onClick={refresh}>
					<RefreshCw />
					{t("workspace.cloud.logs.refresh")}
				</Button>
			</div>
			<div className="flex items-center justify-between gap-3 text-muted-foreground text-sm">
				<span>
					{t("workspace.cloud.logs.window", {
						start: formatDate(windowStartMs, locale, CLOUD_DATE_TIME_FORMAT),
						end: formatDate(windowEndMs, locale, CLOUD_DATE_TIME_FORMAT),
					})}
				</span>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="icon-sm"
						aria-label={t("workspace.cloud.logs.previous")}
						onClick={() =>
							setWindowEndMs(windowEndMs - CLOUD_LOGS_MAX_WINDOW_MS)
						}
					>
						{/* In RTL the older window sits on the right, so the icon mirrors. */}
						<ChevronLeft className="size-4 rtl:-scale-x-100" />
					</Button>
					<Button
						variant="outline"
						size="icon-sm"
						aria-label={t("workspace.cloud.logs.next")}
						disabled={windowEndMs >= newestEndMs}
						onClick={() =>
							setWindowEndMs(
								Math.min(windowEndMs + CLOUD_LOGS_MAX_WINDOW_MS, newestEndMs),
							)
						}
					>
						<ChevronRight className="size-4 rtl:-scale-x-100" />
					</Button>
				</div>
			</div>
			{renderLines()}
		</div>
	);
}
