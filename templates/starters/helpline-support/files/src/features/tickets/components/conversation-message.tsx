// One message of a ticket conversation: a customer message, an agent reply, or an internal note.
// ConversationCard renders one per message. A note sits on a warning tint, so nobody takes it for a reply.
import { LockSimpleIcon } from "@phosphor-icons/react";
import { formatEntryTime, PersonAvatar } from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

type ConversationMessageProps = {
	kind: "customer" | "agent" | "note";
	authorName: string;
	body: string;
	/** The send time, as ISO. */
	at: string;
	/** Milliseconds since 1970, read one time by the card, so every line counts from the same moment. */
	now: number;
};

/** The avatar, the author line with the time, and the text. The full date sits in the title of the time. */
export function ConversationMessage({
	kind,
	authorName,
	body,
	at,
	now,
}: ConversationMessageProps) {
	const { t, locale } = useT();
	const fullDate = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(at));
	return (
		<article className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
			<PersonAvatar
				name={authorName}
				tone={kind === "customer" ? "customer" : "agent"}
				className="row-span-2 size-8"
			/>
			<header className="flex min-h-8 flex-wrap items-center gap-x-2 text-sm">
				<span className="font-medium">{authorName}</span>
				<span className="text-muted-foreground">
					{t(`tickets.authorKinds.${kind}`)}
				</span>
				<time
					dateTime={at}
					title={fullDate}
					className="ms-auto text-muted-foreground text-xs"
				>
					{formatEntryTime(at, now, locale)}
				</time>
			</header>
			<div
				className={cn(
					"rounded-lg px-4 py-3 text-sm leading-relaxed",
					kind === "customer" && "border bg-background/40",
					kind === "agent" && "bg-primary/10",
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
