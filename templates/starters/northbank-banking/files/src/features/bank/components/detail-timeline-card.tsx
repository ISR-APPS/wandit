// The wide card at the top of the end column of a detail page: a vertical line with an icon dot per event.
// The transaction, card, payee, and statement pages render it with their own events, newest or first step on top.
// It follows the "latest activity" card of the kit detail anatomy.
import { ClockIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";

/** One event of the line. */
export type TimelineEvent = {
	/** Stable key, for example the entry id or a step id. */
	id: string;
	/** The icon in the dot. */
	icon: KitIcon;
	title: ReactNode;
	/** A small Badge after the title, for example "Latest" or "Expected". */
	badge?: ReactNode;
	/** The day of the event, `YYYY-MM-DD`, for the time element. */
	day: string;
	/** The day as the reader sees it, already formatted. */
	dayLabel: string;
	/** One or two muted sentences. */
	text: ReactNode;
	/** One outline button under the text, for example a link to the record. */
	action?: ReactNode;
};

type DetailTimelineCardProps = {
	title: string;
	/** A small link at the end of the head, for example "View all". */
	headerAction?: ReactNode;
	events: TimelineEvent[];
	/** One muted sentence when `events` is empty. */
	emptyText: string;
};

/** The dots sit on the start rule, so the line reads the same in Arabic. */
export function DetailTimelineCard({
	title,
	headerAction,
	events,
	emptyText,
}: DetailTimelineCardProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				{headerAction ? <CardAction>{headerAction}</CardAction> : null}
			</CardHeader>
			<CardContent className="ps-8">
				{events.length === 0 ? (
					<p className="text-muted-foreground text-sm">{emptyText}</p>
				) : (
					<ol className="relative grid gap-8 border-s">
						{events.map((event) => (
							<li key={event.id} className="ms-6 grid gap-2">
								<span className="absolute -start-3 flex size-6 items-center justify-center rounded-full border bg-muted">
									<event.icon className="size-3 text-primary" />
								</span>
								<div className="flex flex-wrap items-center gap-2">
									<h3 className="font-semibold" dir="auto">
										{event.title}
									</h3>
									{event.badge}
								</div>
								<time
									dateTime={event.day}
									className="flex items-center gap-1.5 text-muted-foreground text-sm leading-none"
								>
									<ClockIcon className="size-3" />
									{event.dayLabel}
								</time>
								<p className="text-muted-foreground text-sm">{event.text}</p>
								{event.action ? (
									<div className="pt-1">{event.action}</div>
								) : null}
							</li>
						))}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}
