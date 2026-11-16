// Section 2 of the digest, the work to do: the requests that wait for a manager.
// OverviewPage renders it with the request list and the period. The h2 counts every pending request.
// A share bar shows the requests sent in the period by status. The oldest pending requests follow.
import { Link } from "@tanstack/react-router";
import {
	formatRelativeTime,
	PersonAvatar,
	periodDayKeys,
	startOfLocalDay,
	TIME_OFF_STATUSES,
	type TimeOffStatus,
	TimeOffTypeMark,
	toDayKey,
} from "~/features/people";
import type { TimeOffRequest } from "~/features/time-off";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent } from "~/shared/ui/card";
import { DigestSectionHeader } from "./digest-section-header";

// The fill of each status in the share bar: the status tokens of the Badge variants.
const STATUS_FILL = {
	pending: "bg-warning",
	approved: "bg-success",
	declined: "bg-destructive",
	cancelled: "bg-muted-foreground/40",
} satisfies Record<TimeOffStatus, string>;

// The digest lists the oldest waiting requests, at most this many.
const LISTED_REQUESTS = 4;

type RequestsSectionProps = {
	/** Every request, newest first, from timeOffRequestsQueryOptions. */
	requests: TimeOffRequest[];
	/** The period of the page, in days. */
	days: number;
};

/** The requests section: the pending count, the share bar of the period, and the oldest pending requests. */
export function RequestsSection({ requests, days }: RequestsSectionProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const dayCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const dateFormat = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const now = Date.now();
	const inPeriod = new Set(periodDayKeys(days, startOfLocalDay(now)));
	const sent = requests.filter((request) =>
		inPeriod.has(toDayKey(new Date(request.submittedAt))),
	);
	const shares = TIME_OFF_STATUSES.map((status) => ({
		status,
		count: sent.filter((request) => request.status === status).length,
	})).filter((share) => share.count > 0);
	// The list is newest first, so the oldest waiting requests are at the end.
	const pending = requests.filter((request) => request.status === "pending");
	const oldest = pending.slice(-LISTED_REQUESTS).reverse();

	return (
		<Card className="gap-5">
			<DigestSectionHeader
				title={t("overview.toReviewTitle")}
				figure={number.format(pending.length)}
				figureLabel={t("overview.toReviewUnit")}
				to="/app/time-off"
				linkLabel={t("overview.seeRequests")}
				description={`${t("overview.sentInPeriod")} ${number.format(sent.length)}`}
			/>
			<CardContent className="grid gap-5">
				{sent.length > 0 ? (
					<div className="grid gap-2">
						<div className="flex h-2.5 gap-0.5 overflow-hidden rounded-badge">
							{shares.map((share) => (
								<div
									key={share.status}
									className={STATUS_FILL[share.status]}
									style={{ flexGrow: share.count }}
								/>
							))}
						</div>
						<ul className="flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground text-sm">
							{shares.map((share) => (
								<li key={share.status} className="flex items-center gap-2">
									<span
										className={cn(
											"size-2.5 rounded-badge",
											STATUS_FILL[share.status],
										)}
										aria-hidden
									/>
									{t(`timeOffStatuses.${share.status}`)}
									<span className="font-medium text-foreground tabular-nums">
										{number.format(share.count)}
									</span>
								</li>
							))}
						</ul>
					</div>
				) : null}
				{oldest.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("overview.toReviewEmpty")}
					</p>
				) : (
					<ul className="grid divide-y divide-border">
						{oldest.map((request) => (
							<li key={request.id}>
								<Link
									to="/app/time-off"
									search={{ request: request.id }}
									className="-mx-2 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-0.5 rounded-control px-2 py-3 hover:bg-muted"
								>
									<PersonAvatar
										name={request.employeeName}
										className="row-span-2"
									/>
									<span className="truncate font-medium text-sm">
										{request.employeeName}
									</span>
									<span className="text-muted-foreground text-xs tabular-nums">
										{formatRelativeTime(request.submittedAt, now, locale)}
									</span>
									<span className="col-start-2 col-end-4 flex flex-wrap items-center gap-x-3 text-muted-foreground text-sm">
										<TimeOffTypeMark type={request.type} />
										<span className="tabular-nums">
											{dateFormat.formatRange(
												new Date(`${request.startDate}T00:00:00`),
												new Date(`${request.endDate}T00:00:00`),
											)}
										</span>
										<span className="tabular-nums">
											{dayCount.format(request.days)}
										</span>
									</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
