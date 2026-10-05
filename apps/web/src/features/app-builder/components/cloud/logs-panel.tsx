/**
 * Logs panel of the Backend group: the log lines of one source (API, Postgres,
 * or Functions) in a 24-hour window, with a level filter, a text search, and
 * the previous and next windows. It never polls: Refresh reads the newest
 * window. Rendered by cloud-panel-content.tsx inside backend-state.tsx, so the backend
 * is `active` here. Reads cloudLogsQuery.
 */

import { ArrowClockwiseIcon } from "@phosphor-icons/react/ArrowClockwise";
import { ArrowRightIcon } from "@phosphor-icons/react/ArrowRight";
import { CaretLeftIcon } from "@phosphor-icons/react/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/CaretRight";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/MagnifyingGlass";
import { ScrollIcon } from "@phosphor-icons/react/Scroll";
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
import { useState } from "react";

import { formatDate, formatNumber, useTranslation } from "@/lib/i18n";
import { cloudLogsQuery } from "../../api/cloud.queries";
import { CLOUD_DATE_TIME_FORMAT } from "../../lib/constants";
import {
	PANEL_CARD_CLASS,
	PANEL_INPUT_CLASS,
	PANEL_SECONDARY_BUTTON_CLASS,
	PANEL_TABS_LIST_CLASS,
	PANEL_TABS_TRIGGER_CLASS,
	PanelChip,
	type PanelChipTone,
	PanelMessage,
} from "../more/panel-shell";
import { IconAction, TOOLBAR_ICON_BUTTON_CLASS } from "../shell/top-bar";
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

/** Chip tone of each level. The text label keeps the level readable without the color. */
const LEVEL_TONE = {
	info: "neutral",
	warning: "warning",
	error: "danger",
} as const satisfies Record<CloudLogLevel, PanelChipTone>;

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
				<PanelMessage
					icon={ScrollIcon}
					text={t("workspace.cloud.logs.empty")}
				/>
			);
		}
		return (
			<div className="flex min-w-0 flex-col gap-2">
				{/* Log lines read left to right in every locale. Long lines wrap inside the panel. */}
				<ol
					dir="ltr"
					aria-busy={logs.isPlaceholderData}
					className={cn(
						PANEL_CARD_CLASS,
						"divide-y divide-night/[0.06] overflow-hidden font-mono text-[12.5px] text-night/85 transition-opacity dark:divide-white/[0.06] dark:text-foreground/85",
						logs.isPlaceholderData && "opacity-60",
					)}
				>
					{logs.data.map((entry) => (
						<li
							key={entry.id}
							className={cn(
								"flex items-start gap-3 px-4 py-2.5",
								// An error line gets a faint red wash, so it stands out in a long list.
								entry.level === "error" && "bg-destructive/[0.04]",
							)}
						>
							{/* The list is left to right, but an Arabic date reads right to left: "auto" keeps its order. */}
							<time
								dir="auto"
								dateTime={entry.timestamp}
								className="min-w-40 shrink-0 whitespace-nowrap pt-0.5 text-night/45 tabular-nums dark:text-foreground/45"
							>
								{formatDate(entry.timestamp, locale, CLOUD_DATE_TIME_FORMAT)}
							</time>
							<PanelChip
								tone={LEVEL_TONE[entry.level]}
								className="h-5 px-2 text-[11px]"
							>
								{t(`workspace.cloud.logs.levels.${entry.level}`)}
							</PanelChip>
							<span className="min-w-0 whitespace-pre-wrap break-all pt-0.5">
								{entry.message}
							</span>
						</li>
					))}
				</ol>
				{/* The route answers at most 100 lines, so a full page can hide older lines of the window. */}
				{logs.data.length >= CLOUD_LOGS_PAGE_SIZE ? (
					<p className="px-1 font-sans text-[13px] text-night/55 dark:text-foreground/55">
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
			{/* One 48 px row from about 580 px of panel width. Below that, the search wraps to its own full row. */}
			<div className="flex min-h-12 flex-wrap items-center gap-2">
				<Tabs
					value={source}
					onValueChange={(value) => {
						const next = cloudLogSources.find((item) => item === value);
						if (next) setSource(next);
					}}
				>
					<TabsList className={PANEL_TABS_LIST_CLASS}>
						{cloudLogSources.map((item) => (
							<TabsTrigger
								key={item}
								value={item}
								className={PANEL_TABS_TRIGGER_CLASS}
							>
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
						aria-label={t("workspace.cloud.logs.levelLabel")}
						className={cn(
							PANEL_SECONDARY_BUTTON_CLASS,
							"rounded-full px-4 data-[size=default]:h-10",
						)}
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
				{/* The search text is a log message, so the field reads left to right in every locale. The icons follow it. */}
				<form
					dir="ltr"
					className="relative min-w-40 flex-1"
					onSubmit={(event) => {
						event.preventDefault();
						setSearch(searchDraft.trim());
					}}
				>
					<MagnifyingGlassIcon
						aria-hidden
						weight="bold"
						className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-night/40 dark:text-foreground/45"
					/>
					<Input
						type="search"
						value={searchDraft}
						maxLength={SEARCH_MAX_LENGTH}
						onChange={(event) => setSearchDraft(event.target.value)}
						aria-label={t("workspace.cloud.logs.searchLabel")}
						className={cn(
							PANEL_INPUT_CLASS,
							"ps-10 pe-11 font-mono md:text-[13px]",
						)}
					/>
					<IconAction label={t("workspace.cloud.logs.search")}>
						<Button
							type="submit"
							variant="ghost"
							size="icon-sm"
							className={cn(
								TOOLBAR_ICON_BUTTON_CLASS,
								"absolute end-1 top-1/2 -translate-y-1/2",
							)}
						>
							<ArrowRightIcon aria-hidden weight="bold" className="size-4" />
						</Button>
					</IconAction>
				</form>
			</div>
			<div className="flex items-center justify-between gap-3 px-1 font-grotesk text-[13px] text-night/55 tabular-nums dark:text-foreground/55">
				<span>
					{t("workspace.cloud.logs.window", {
						start: formatDate(windowStartMs, locale, CLOUD_DATE_TIME_FORMAT),
						end: formatDate(windowEndMs, locale, CLOUD_DATE_TIME_FORMAT),
					})}
				</span>
				{/* Refresh sits with the window buttons: it moves the window to now. */}
				<div className="flex items-center gap-1.5">
					<IconAction label={t("workspace.cloud.logs.refresh")}>
						<Button
							variant="outline"
							size="icon-sm"
							className={cn(PANEL_SECONDARY_BUTTON_CLASS, "me-1.5")}
							onClick={refresh}
						>
							<ArrowClockwiseIcon aria-hidden weight="bold" />
						</Button>
					</IconAction>
					<IconAction label={t("workspace.cloud.logs.previous")}>
						<Button
							variant="outline"
							size="icon-sm"
							className={PANEL_SECONDARY_BUTTON_CLASS}
							onClick={() =>
								setWindowEndMs(windowEndMs - CLOUD_LOGS_MAX_WINDOW_MS)
							}
						>
							{/* In RTL the older window sits on the right, so the icon mirrors. */}
							<CaretLeftIcon
								aria-hidden
								weight="bold"
								className="rtl:-scale-x-100"
							/>
						</Button>
					</IconAction>
					<IconAction label={t("workspace.cloud.logs.next")}>
						<Button
							variant="outline"
							size="icon-sm"
							className={PANEL_SECONDARY_BUTTON_CLASS}
							disabled={windowEndMs >= newestEndMs}
							onClick={() =>
								setWindowEndMs(
									Math.min(windowEndMs + CLOUD_LOGS_MAX_WINDOW_MS, newestEndMs),
								)
							}
						>
							<CaretRightIcon
								aria-hidden
								weight="bold"
								className="rtl:-scale-x-100"
							/>
						</Button>
					</IconAction>
				</div>
			</div>
			{renderLines()}
		</div>
	);
}
