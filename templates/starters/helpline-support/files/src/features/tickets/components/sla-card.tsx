// The two SLA clocks of one ticket: the first reply and the resolution, each against the target of its priority.
// TicketDetailPage renders it in its rail. A running clock shows a bar of the time used; a stopped one shows met or missed.
import {
	FIRST_REPLY_TARGET_MINUTES,
	MINUTE_MS,
	RESOLUTION_TARGET_MINUTES,
} from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { TicketDetail } from "../api/tickets.queries";
import { type ClockState, SlaClock } from "./sla-clock";

type SlaCardProps = {
	ticket: TicketDetail;
};

/** One clock per row: its name, its target, and its state. */
export function SlaCard({ ticket }: SlaCardProps) {
	const { t } = useT();
	const now = Date.now();
	const created = Date.parse(ticket.createdAt);
	const minutesSince = (from: number, to: number) => (to - from) / MINUTE_MS;
	const firstReply: ClockState = ticket.firstReplyAt
		? {
				kind: "done",
				tookMinutes: minutesSince(created, Date.parse(ticket.firstReplyAt)),
			}
		: { kind: "running", elapsedMinutes: minutesSince(created, now) };
	// Pending stops the resolution clock: the team waits for the customer.
	const resolution: ClockState = ticket.solvedAt
		? {
				kind: "done",
				tookMinutes: minutesSince(created, Date.parse(ticket.solvedAt)),
			}
		: ticket.status === "pending"
			? { kind: "paused" }
			: { kind: "running", elapsedMinutes: minutesSince(created, now) };

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("tickets.sla")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-5">
				<SlaClock
					label={t("tickets.firstReply")}
					targetMinutes={FIRST_REPLY_TARGET_MINUTES[ticket.priority]}
					state={firstReply}
				/>
				<SlaClock
					label={t("tickets.resolution")}
					targetMinutes={RESOLUTION_TARGET_MINUTES[ticket.priority]}
					state={resolution}
				/>
			</CardContent>
		</Card>
	);
}
