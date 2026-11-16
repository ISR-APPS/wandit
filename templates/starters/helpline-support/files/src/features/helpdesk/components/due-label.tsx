// The deadline of an open ticket in words: "Late by 25 min" in red, "in 40 min", or "Paused" for a pending ticket.
// Next up, the queue panel, and the ticket list render it. The time counts from `now`, which the page reads one time.
import { useT } from "~/shared/i18n";
import { fillMessage } from "../lib/format";
import {
	formatDuration,
	formatRelativeTime,
	MINUTE_MS,
} from "../lib/relative-time";
import { isLate } from "../lib/ticket-rules";

type DueLabelProps = {
	/** The SLA deadline (ISO), or null when the clock is paused. */
	dueAt: string | null;
	/** Milliseconds since 1970. */
	now: number;
};

/** A short line. A late ticket also gets a medium weight, so the color is not the only mark. */
export function DueLabel({ dueAt, now }: DueLabelProps) {
	const { t, locale } = useT();
	if (dueAt === null) {
		return (
			<span className="whitespace-nowrap text-muted-foreground">
				{t("queue.paused")}
			</span>
		);
	}
	if (isLate(dueAt, now)) {
		return (
			<span className="whitespace-nowrap font-medium text-destructive">
				{fillMessage(t("queue.lateBy"), {
					time: formatDuration((now - Date.parse(dueAt)) / MINUTE_MS, locale),
				})}
			</span>
		);
	}
	return (
		<span className="whitespace-nowrap">
			{formatRelativeTime(dueAt, now, locale)}
		</span>
	);
}
