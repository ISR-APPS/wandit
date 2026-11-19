// One message of the ticket thread as a chat bubble: the customer at the start, the team at the end.
// TicketThread renders one per message. A note sits on a warning tint, so nobody takes it for a reply.
import { LockSimpleIcon } from "@phosphor-icons/react";
import { formatEntryTime } from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

type ThreadMessageProps = {
	kind: "customer" | "agent" | "note";
	authorName: string;
	body: string;
	/** The send time, as ISO. */
	at: string;
	/** Milliseconds since 1970, read one time by the thread, so every line counts from the same moment. */
	now: number;
};

/** The author line with the time, then the bubble. The full date sits in the title of the time. */
export function ThreadMessage({
	kind,
	authorName,
	body,
	at,
	now,
}: ThreadMessageProps) {
	const { t, locale } = useT();
	const isTeam = kind !== "customer";
	const fullDate = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(at));
	return (
		<article
			className={cn(
				"grid max-w-[80%] gap-1",
				isTeam ? "justify-items-end justify-self-end" : "justify-items-start",
			)}
		>
			<header className="flex flex-wrap items-center gap-x-2 text-muted-foreground text-xs">
				<bdi className="font-medium text-foreground">{authorName}</bdi>
				<time dateTime={at} title={fullDate}>
					{formatEntryTime(at, now, locale)}
				</time>
			</header>
			<div
				className={cn(
					"rounded-surface p-3 text-sm leading-relaxed",
					kind === "customer" && "bg-muted",
					kind === "agent" && "bg-primary text-primary-foreground",
					kind === "note" && "border border-warning/30 bg-warning/10",
				)}
			>
				{kind === "note" ? (
					<p className="mb-1 flex items-center gap-1.5 font-medium text-warning text-xs">
						<LockSimpleIcon className="size-3.5" />
						{t("tickets.noteLabel")}
					</p>
				) : null}
				<p className="whitespace-pre-line" dir="auto">
					{body}
				</p>
			</div>
		</article>
	);
}
