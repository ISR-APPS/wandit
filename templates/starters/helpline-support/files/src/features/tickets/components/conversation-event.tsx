// One change of a ticket in its conversation: taken by an agent, set to pending, solved, or closed.
// ConversationCard renders one per event, between the messages, as a quiet line with an icon.
import {
	CheckCircleIcon,
	HourglassMediumIcon,
	LockKeyIcon,
	UserCirclePlusIcon,
} from "@phosphor-icons/react";
import { fillMessage, formatEntryTime } from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import type { KitIcon } from "~/shared/ui/icons";
import type { ConversationEntry } from "../api/tickets.queries";

/** One icon per kind of change. */
const EVENT_ICON = {
	assigned: UserCirclePlusIcon,
	pending: HourglassMediumIcon,
	solved: CheckCircleIcon,
	closed: LockKeyIcon,
} satisfies Record<
	Extract<ConversationEntry, { kind: "event" }>["event"],
	KitIcon
>;

type ConversationEventProps = {
	event: Extract<ConversationEntry, { kind: "event" }>["event"];
	/** The agent of the change. null for the nightly job that closes solved tickets. */
	agentName: string | null;
	/** The time of the change, as ISO. */
	at: string;
	/** Milliseconds since 1970, read one time by the card. */
	now: number;
};

/** A muted line: the icon, "Theo Brandt took the ticket", and the time (relative for today). */
export function ConversationEvent({
	event,
	agentName,
	at,
	now,
}: ConversationEventProps) {
	const { t, locale } = useT();
	const Icon = EVENT_ICON[event];
	return (
		<p className="flex flex-wrap items-center gap-x-2 gap-y-1 ps-2.5 text-muted-foreground text-xs">
			<Icon className="size-4 shrink-0" />
			<span>
				{fillMessage(t(`tickets.events.${event}`), { agent: agentName ?? "" })}
			</span>
			<span aria-hidden="true">·</span>
			<time dateTime={at}>{formatEntryTime(at, now, locale)}</time>
		</p>
	);
}
