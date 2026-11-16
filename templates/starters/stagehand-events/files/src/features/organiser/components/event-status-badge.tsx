// The status Badge of one event: a word and a color, never a color alone.
// The home list, the events table, the event page, and the venue panel render it.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import type { EventStatus } from "../lib/box-office";
import { EVENT_STATUS_BADGE } from "../lib/status-badges";

type EventStatusBadgeProps = {
	status: EventStatus;
};

/** A live event shows a dot before the word, so the show that runs now stands out in a list. */
export function EventStatusBadge({ status }: EventStatusBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={EVENT_STATUS_BADGE[status]}>
			{status === "live" ? (
				<span
					aria-hidden="true"
					className="size-1.5 rounded-full bg-primary-foreground motion-safe:animate-pulse"
				/>
			) : null}
			{t(`events.statuses.${status}`)}
		</Badge>
	);
}
