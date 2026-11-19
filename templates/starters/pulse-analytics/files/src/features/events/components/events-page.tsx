// The event log behind login, in the anatomy of the kit transaction list: the title with an area select and
// a download icon button, the tabs Today and Yesterday, then one card with a row per event.
// The /app/events route renders it after its loader. The route also uses the skeleton and the error below.
// A row gives the time, the event sentence with the user and the account, the platform, and a link to the account.
import {
	CaretRightIcon,
	DownloadSimpleIcon,
	FunnelSimpleIcon,
} from "@phosphor-icons/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	downloadCsv,
	FEATURE_AREAS,
	fillMessage,
	toCsv,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "~/shared/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	type AreaFilter,
	eventLogQueryOptions,
	type LoggedEvent,
} from "../api/events.queries";

/** The two tabs of the log. */
type LogDay = "today" | "yesterday";

/** The area select reads the log of one area. The download exports the rows of the open tab. */
export function EventsPage() {
	const { t } = useT();
	const [area, setArea] = useState<AreaFilter>("all");
	const [day, setDay] = useState<LogDay>("today");
	// The loader fills "all". Another area loads here and keeps the old rows until it is ready.
	const log = useQuery({
		...eventLogQueryOptions(area),
		placeholderData: keepPreviousData,
	});

	function exportRows(rows: LoggedEvent[]) {
		downloadCsv(
			`events-${day}.csv`,
			toCsv(rows, [
				{ header: t("events.csv.time"), value: (row) => row.occurredAt },
				{ header: t("events.csv.event"), value: (row) => row.eventKey },
				{ header: t("events.csv.user"), value: (row) => row.personName },
				{ header: t("events.csv.account"), value: (row) => row.accountName },
				{
					header: t("events.csv.platform"),
					value: (row) => t(`platforms.${row.platform}`),
				},
			]),
		);
	}

	return (
		// grid-cols-1 is minmax(0, 1fr): a wide row scrolls inside the card and does not widen the page.
		<div className="grid grid-cols-1 gap-4">
			<PageHeader
				title={t("events.title")}
				actions={
					<>
						<Select
							value={area}
							onValueChange={(value) => {
								const next = FEATURE_AREAS.find((item) => item === value);
								setArea(next ?? "all");
							}}
						>
							<SelectTrigger
								aria-label={t("events.areaFilter")}
								className="w-auto gap-2"
							>
								<FunnelSimpleIcon className="size-4 text-muted-foreground" />
								<SelectValue />
							</SelectTrigger>
							<SelectContent align="end">
								<SelectItem value="all">{t("events.allAreas")}</SelectItem>
								{FEATURE_AREAS.map((item) => (
									<SelectItem key={item} value={item}>
										{t(`areas.${item}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							type="button"
							size="icon"
							aria-label={t("events.download")}
							disabled={log.data === undefined}
							onClick={() => {
								if (log.data) {
									exportRows(log.data[day]);
								}
							}}
						>
							<DownloadSimpleIcon />
						</Button>
					</>
				}
			/>
			<Tabs
				value={day}
				onValueChange={(value) => {
					if (value === "today" || value === "yesterday") {
						setDay(value);
					}
				}}
			>
				<TabsList className="mb-2">
					<TabsTrigger value="today">{t("events.tabs.today")}</TabsTrigger>
					<TabsTrigger value="yesterday">
						{t("events.tabs.yesterday")}
					</TabsTrigger>
				</TabsList>
				<Card className="py-0">
					<CardContent className="px-0">
						{log.isError ? (
							<div className="grid justify-items-center gap-3 px-4 py-10 text-center">
								<p className="text-sm" role="alert">
									{t("events.loadError")}
								</p>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => log.refetch()}
								>
									{t("common.retry")}
								</Button>
							</div>
						) : log.data === undefined ? (
							<LogSkeleton />
						) : (
							<>
								<TabsContent value="today">
									<EventRows
										rows={log.data.today}
										emptyText={t("events.emptyToday")}
									/>
								</TabsContent>
								<TabsContent value="yesterday">
									<EventRows
										rows={log.data.yesterday}
										emptyText={t("events.emptyYesterday")}
									/>
								</TabsContent>
							</>
						)}
					</CardContent>
				</Card>
			</Tabs>
		</div>
	);
}

type EventRowsProps = {
	/** The events of one day, newest first. */
	rows: LoggedEvent[];
	/** The sentence when the day has no event in the chosen area. */
	emptyText: string;
};

// One table row per event: time, the event sentence over the user and the account, the platform, and the arrow link.
function EventRows({ rows, emptyText }: EventRowsProps) {
	const { t, locale } = useT();
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	if (rows.length === 0) {
		return (
			<p className="px-4 py-10 text-center text-muted-foreground text-sm">
				{emptyText}
			</p>
		);
	}
	return (
		<Table>
			<TableBody>
				{rows.map((row) => (
					<TableRow key={row.id}>
						<TableCell className="@md/main:w-36 w-20 @md/main:ps-6 ps-4 tabular-nums">
							<time dateTime={row.occurredAt}>
								{time.format(new Date(row.occurredAt))}
							</time>
						</TableCell>
						{/* The base cell does not wrap. This cell wraps, so the row fits a 390 px phone. */}
						<TableCell className="whitespace-normal">
							<p className="font-medium">{t(`eventTypes.${row.eventKey}`)}</p>
							<p className="text-muted-foreground text-sm">
								{fillMessage(t("events.byLine"), {
									person: row.personName,
									account: row.accountName,
								})}
							</p>
						</TableCell>
						<TableCell className="pe-6">
							<div className="flex items-center justify-end gap-4">
								{/* A phone has no room for the platform. The CSV export keeps it. */}
								<span className="@md/main:inline hidden text-muted-foreground text-sm">
									{t(`platforms.${row.platform}`)}
								</span>
								<Button variant="outline" size="sm" asChild>
									<Link
										to="/app/accounts/$accountId"
										params={{ accountId: row.accountId }}
										aria-label={fillMessage(t("events.openAccount"), {
											account: row.accountName,
										})}
									>
										<CaretRightIcon className="rtl:rotate-180" />
									</Link>
								</Button>
							</div>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

// Placeholder keys of the rows. Fixed keys, because the skeleton never reorders.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7"];

// The rows of the card while the log loads.
function LogSkeleton() {
	return (
		<div className="grid gap-2 p-4">
			{SKELETON_ROWS.map((key) => (
				<Skeleton key={key} className="h-12 w-full" />
			))}
		</div>
	);
}

/** Placeholder while the Events loader runs. The route sets it as pendingComponent. */
export function EventsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-9 w-48" />
			</div>
			<Skeleton className="h-9 w-48" />
			<Skeleton className="h-96" />
		</div>
	);
}

/** Error state of the Events page when the loader fails. Try again runs the loader again. */
export function EventsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("events.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
