// The home behind login: the queue of the support desk (focus-queue home).
// Top row: Next up and the open queue. Bottom row: tickets solved per day with the desk figures, and tickets by topic.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	fillMessage,
	isLate,
	type PeriodDays,
	type TicketTopic,
} from "~/features/helpdesk";
import { ticketsQueryOptions } from "~/features/tickets";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { receivedByTopicQueryOptions } from "../api/desk.queries";
import { DEFAULT_DAYS, openTicketsInOrder } from "../lib/queue";
import { NextUpCard } from "./next-up-card";
import { OpenQueueCard } from "./open-queue-card";
import { SolvedCard } from "./solved-card";
import { TopicBreakdownCard } from "./topic-breakdown-card";

/** The queue home. The header counts, Next up, and the queue all read one ordered list of open tickets. */
export function QueuePage() {
	const { t, locale } = useT();
	const { data: tickets } = useSuspenseQuery(ticketsQueryOptions());
	const { data: topics } = useSuspenseQuery(
		receivedByTopicQueryOptions(DEFAULT_DAYS),
	);
	const [days, setDays] = useState<PeriodDays>(DEFAULT_DAYS);
	const now = Date.now();
	const number = new Intl.NumberFormat(locale);

	const open = openTicketsInOrder(tickets);
	const lateCount = open.filter((ticket) => isLate(ticket.dueAt, now)).length;
	const unassignedCount = open.filter(
		(ticket) => ticket.assignee === null,
	).length;
	// The "other" slice also holds the small named topics that the breakdown query folds into it.
	const namedTopics: TicketTopic[] = topics
		.map((slice) => slice.label)
		.filter((topic) => topic !== "other");
	const openOfSlice = (label: string) =>
		open.filter((ticket) =>
			label === "other"
				? !namedTopics.includes(ticket.topic)
				: ticket.topic === label,
		);

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("queue.title")}
				description={fillMessage(t("queue.headerCounts"), {
					open: number.format(open.length),
					late: number.format(lateCount),
					unassigned: number.format(unassignedCount),
				})}
			/>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @3xl/main:gap-6 gap-4">
				<NextUpCard ticket={open[0] ?? null} now={now} />
				<div className="@4xl/main:col-span-2 min-w-0">
					<OpenQueueCard open={open} now={now} />
				</div>
			</div>
			<div className="grid @4xl/main:grid-cols-2 grid-cols-1 @3xl/main:gap-6 gap-4">
				<SolvedCard days={days} onDaysChange={setDays} />
				<TopicBreakdownCard
					days={DEFAULT_DAYS}
					slices={topics.map((slice) => {
						const openTickets = openOfSlice(slice.label);
						return {
							id: slice.label,
							label: t(`topics.${slice.label}`),
							value: slice.value,
							open: openTickets.length,
							late: openTickets.filter((ticket) => isLate(ticket.dueAt, now))
								.length,
						};
					})}
				/>
			</div>
		</div>
	);
}

/** Placeholder while the home loader runs. It draws the two rows with the same spans and heights. */
export function QueuePageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-4 w-56" />
			</div>
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @3xl/main:gap-6 gap-4">
				<Skeleton className="h-[28rem] rounded-surface" />
				<Card className="@4xl/main:col-span-2">
					<CardHeader>
						<Skeleton className="h-5 w-32" />
					</CardHeader>
					<CardContent className="grid gap-3">
						<Skeleton className="h-9 w-72" />
						{["a", "b", "c", "d", "e", "f"].map((key) => (
							<Skeleton key={key} className="h-11 w-full" />
						))}
					</CardContent>
				</Card>
			</div>
			<div className="grid @4xl/main:grid-cols-2 grid-cols-1 @3xl/main:gap-6 gap-4">
				<Skeleton className="h-96 rounded-surface" />
				<Skeleton className="h-96 rounded-surface" />
			</div>
		</div>
	);
}

/** Error state of the home when its loader fails. Try again runs the loader again. */
export function QueuePageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("queue.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
