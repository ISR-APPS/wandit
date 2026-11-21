// The time-off page behind login: the leave calendar of the kit calendar app, then the table of every request.
// The /app/time-off route renders it after its loader. The route also uses the skeleton and the error below.
// The open request lives in the URL (?request=TO-4127). The calendar chips and the table rows open the same dialog.
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
	fillMessage,
	startOfLocalDay,
	TIME_OFF_STATUSES,
	TIME_OFF_TYPES,
} from "~/features/people";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { RecordFilter } from "~/shared/ui/record-table";
import { Skeleton } from "~/shared/ui/skeleton";
import { timeOffRequestsQueryOptions } from "../api/time-off.queries";
import { LeaveCalendarCard } from "./leave-calendar-card";
import { RequestDialog } from "./request-dialog";
import { RequestTable } from "./request-table";

const routeApi = getRouteApi("/app/time-off");

// Twelve rows keep the table near one screen high under the calendar.
const REQUESTS_PAGE_SIZE = 12;

/** The kit calendar page has no page title row, so the h1 is for screen readers only. */
export function TimeOffPage() {
	const { t, locale } = useT();
	const { data: requests } = useSuspenseQuery(timeOffRequestsQueryOptions());
	const { request: requestId } = routeApi.useSearch();
	const navigate = routeApi.useNavigate();
	// The id of the request that the dialog showed last. The dialog keeps it while it closes.
	const [closingId, setClosingId] = useState<string | null>(null);
	const [status, setStatus] = useState<string | null>(null);
	const [type, setType] = useState<string | null>(null);

	const openRequest = requests.find((row) => row.id === requestId) ?? null;
	const dialogRequest =
		openRequest ?? requests.find((row) => row.id === closingId) ?? null;
	const rows = requests.filter(
		(request) =>
			(status === null || request.status === status) &&
			(type === null || request.type === type),
	);

	function open(id: string) {
		navigate({ search: { request: id }, replace: true });
	}

	return (
		<div className="grid gap-4">
			<h1 className="sr-only">{t("timeOff.title")}</h1>
			<LeaveCalendarCard
				requests={requests}
				todayStart={startOfLocalDay(Date.now())}
				onOpen={open}
			/>
			<Card className="min-w-0">
				<CardHeader>
					<CardTitle>{t("timeOff.requestsTitle")}</CardTitle>
					<CardDescription>
						{fillMessage(t("timeOff.requestsDescription"), {
							count: new Intl.NumberFormat(locale).format(requests.length),
						})}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<RequestTable
						requests={rows}
						variant="list"
						pageSize={REQUESTS_PAGE_SIZE}
						searchable
						noResults={t("timeOff.noResults")}
						toolbar={
							<>
								<RecordFilter
									label={t("timeOff.status")}
									options={TIME_OFF_STATUSES.map((value) => ({
										value,
										label: t(`timeOffStatuses.${value}`),
									}))}
									value={status}
									onValueChange={setStatus}
								/>
								<RecordFilter
									label={t("timeOff.type")}
									options={TIME_OFF_TYPES.map((value) => ({
										value,
										label: t(`timeOffTypes.${value}`),
									}))}
									value={type}
									onValueChange={setType}
								/>
							</>
						}
					/>
				</CardContent>
			</Card>
			<RequestDialog
				request={dialogRequest}
				open={openRequest !== null}
				onOpenChange={(isOpen) => {
					if (!isOpen) {
						setClosingId(requestId ?? null);
						navigate({ search: {}, replace: true });
					}
				}}
			/>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6"];

/** Placeholder while the time-off loader runs. The route sets it as pendingComponent. */
export function TimeOffPageSkeleton() {
	return (
		<div className="grid gap-4">
			<Skeleton className="h-160" />
			<Card>
				<CardContent className="grid gap-3">
					<Skeleton className="h-5 w-48" />
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-9 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}

/** Error state of the page when the loader fails. Try again runs the loader again. */
export function TimeOffPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("timeOff.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
