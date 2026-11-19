// The thread pane of the ticket page: a toolbar, the requester head with the ticket facts,
// the conversation as bubbles, and the reply box at the bottom.
// TicketDetailPage renders it as the last pane of the inbox card. The reply goes through useAddReplyMutation.
// It follows the message pane of the kit mail page.
import {
	ArrowBendUpLeftIcon,
	ArrowLeftIcon,
	BuildingsIcon,
	CopyIcon,
	DotsThreeVerticalIcon,
	LockSimpleIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";
import {
	copyToClipboard,
	DueLabel,
	downloadCsv,
	PersonAvatar,
	PriorityBadge,
	TicketStatusBadge,
	toCsv,
} from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Checkbox } from "~/shared/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";
import { CaretDownIcon, CaretUpIcon } from "~/shared/ui/icons";
import { Label } from "~/shared/ui/label";
import { Separator } from "~/shared/ui/separator";
import { Textarea } from "~/shared/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/ui/tooltip";
import { useAddReplyMutation } from "../api/tickets.mutations";
import type { TicketDetail } from "../api/tickets.queries";
import { ConversationEvent } from "./conversation-event";
import { ThreadMessage } from "./thread-message";

type TicketThreadProps = {
	ticket: TicketDetail;
	/** The ticket above this one in the list pane, or null at the top or when the list does not hold it. */
	previousId: string | null;
	/** The ticket below this one in the list pane, or null at the end. */
	nextId: string | null;
	/** Milliseconds since 1970, read one time by the page. */
	now: number;
};

/** The pane fills the card height. Only the conversation scrolls; the toolbar and the reply box stay. */
export function TicketThread({
	ticket,
	previousId,
	nextId,
	now,
}: TicketThreadProps) {
	const { t, locale } = useT();
	const [draft, setDraft] = useState("");
	const [isNote, setIsNote] = useState(false);
	const replyRef = useRef<HTMLTextAreaElement>(null);
	const addReply = useAddReplyMutation(ticket.id);
	const created = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(ticket.createdAt));

	function startReply(asNote: boolean) {
		setIsNote(asNote);
		replyRef.current?.focus();
	}

	function submitReply(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const body = draft.trim();
		if (body === "") {
			return;
		}
		addReply.mutate(
			{ kind: isNote ? "note" : "agent", body, authorName: t("tickets.you") },
			{
				onSuccess: () => {
					setDraft("");
					toast.success(t(isNote ? "tickets.noteAdded" : "tickets.replyAdded"));
				},
				onError: () => toast.error(t("tickets.replyFailed")),
			},
		);
	}

	return (
		<section
			aria-label={ticket.subject}
			className="flex min-h-0 min-w-0 flex-1 flex-col"
		>
			<div className="flex h-14 shrink-0 items-center gap-1 px-2">
				<ToolbarButton label={t("tickets.backToList")}>
					<Link to="/app/tickets">
						<ArrowLeftIcon className="rtl:rotate-180" />
					</Link>
				</ToolbarButton>
				<ToolbarButton
					label={t("tickets.previousTicket")}
					disabled={!previousId}
				>
					{previousId ? (
						<Link to="/app/tickets/$ticketId" params={{ ticketId: previousId }}>
							<CaretUpIcon />
						</Link>
					) : (
						<span>
							<CaretUpIcon />
						</span>
					)}
				</ToolbarButton>
				<ToolbarButton label={t("tickets.nextTicket")} disabled={!nextId}>
					{nextId ? (
						<Link to="/app/tickets/$ticketId" params={{ ticketId: nextId }}>
							<CaretDownIcon />
						</Link>
					) : (
						<span>
							<CaretDownIcon />
						</span>
					)}
				</ToolbarButton>
				<Separator
					orientation="vertical"
					className="mx-1 data-[orientation=vertical]:h-6"
				/>
				<ToolbarButton label={t("tickets.openCustomer")}>
					<Link to="/app/customers" search={{ customer: ticket.customer.id }}>
						<BuildingsIcon />
					</Link>
				</ToolbarButton>
				<div className="ms-auto flex items-center gap-1">
					<ToolbarButton label={t("tickets.reply")}>
						<button type="button" onClick={() => startReply(false)}>
							<ArrowBendUpLeftIcon className="rtl:-scale-x-100" />
						</button>
					</ToolbarButton>
					<ToolbarButton label={t("tickets.addNote")}>
						<button type="button" onClick={() => startReply(true)}>
							<LockSimpleIcon />
						</button>
					</ToolbarButton>
					<ToolbarButton label={t("tickets.copyNumber")}>
						<button
							type="button"
							onClick={() =>
								copyToClipboard(ticket.id, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							<CopyIcon />
						</button>
					</ToolbarButton>
				</div>
				<Separator
					orientation="vertical"
					className="mx-1 data-[orientation=vertical]:h-6"
				/>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" aria-label={t("tickets.more")}>
							<DotsThreeVerticalIcon />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="min-w-48">
						<DropdownMenuItem
							onSelect={() =>
								copyToClipboard(ticket.requester.email, {
									done: t("table.copied"),
									failed: t("table.copyFailed"),
								})
							}
						>
							{t("tickets.copyEmail")}
						</DropdownMenuItem>
						{ticket.article ? (
							<DropdownMenuItem asChild>
								<Link
									to="/app/articles"
									search={{ article: ticket.article.id }}
								>
									{t("tickets.openArticle")}
								</Link>
							</DropdownMenuItem>
						) : null}
						<DropdownMenuItem
							onSelect={() =>
								downloadCsv(
									`ticket-${ticket.id}.csv`,
									toCsv(
										ticket.conversation.flatMap((entry) =>
											entry.kind === "event" ? [] : [entry],
										),
										[
											{
												header: t("tickets.sentAt"),
												value: (entry) => entry.at,
											},
											{
												header: t("tickets.author"),
												value: (entry) => entry.authorName,
											},
											{
												header: t("tickets.kind"),
												value: (entry) =>
													t(`tickets.authorKinds.${entry.kind}`),
											},
											{
												header: t("tickets.message"),
												value: (entry) => entry.body,
											},
										],
									),
								)
							}
						>
							{t("tickets.exportConversation")}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<Separator />
			<div className="flex shrink-0 items-start gap-4 p-4">
				<PersonAvatar name={ticket.requester.name} className="size-10" />
				<div className="grid min-w-0 flex-1 gap-1">
					<bdi className="font-semibold text-sm">{ticket.requester.name}</bdi>
					<p className="line-clamp-1 text-xs" dir="auto">
						{ticket.subject}
					</p>
					<p className="line-clamp-1 text-xs">
						<span className="font-medium">{t("tickets.from")}</span>{" "}
						{`${ticket.requester.email} · ${ticket.customer.name}`}
					</p>
					<div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
						<TicketStatusBadge status={ticket.status} />
						<PriorityBadge priority={ticket.priority} />
						<Badge variant="outline">
							{t(`tickets.channels.${ticket.channel}`)}
						</Badge>
						<Badge variant="secondary">{t(`topics.${ticket.topic}`)}</Badge>
						<span className="text-muted-foreground">
							{`${t("tickets.agent")}: ${ticket.assignee?.name ?? t("tickets.unassigned")}`}
						</span>
						{ticket.status === "new" || ticket.status === "open" ? (
							<span className="flex items-center gap-1">
								<span className="text-muted-foreground">
									{`${t("tickets.slaLeft")}:`}
								</span>
								<DueLabel dueAt={ticket.dueAt} now={now} />
							</span>
						) : null}
					</div>
				</div>
				<time
					dateTime={ticket.createdAt}
					className="@4xl/main:block hidden shrink-0 text-muted-foreground text-xs"
				>
					{created}
				</time>
			</div>
			<Separator />
			<div
				ref={scrollToNewest}
				className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto p-4"
			>
				{ticket.conversation.map((entry) =>
					entry.kind === "event" ? (
						<ConversationEvent
							key={entry.id}
							event={entry.event}
							agentName={entry.agentName}
							at={entry.at}
							now={now}
						/>
					) : (
						<ThreadMessage
							key={entry.id}
							kind={entry.kind}
							authorName={entry.authorName}
							body={entry.body}
							at={entry.at}
							now={now}
						/>
					),
				)}
			</div>
			<Separator />
			<form onSubmit={submitReply} className="grid shrink-0 gap-4 p-4">
				<Textarea
					ref={replyRef}
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					placeholder={
						isNote
							? t("tickets.notePlaceholder")
							: `${t("tickets.replyTo")} ${ticket.requester.name}…`
					}
					aria-label={t("tickets.reply")}
					className="min-h-20 p-4"
				/>
				<div className="flex items-center gap-2">
					<Label className="flex items-center gap-2 font-normal text-xs">
						<Checkbox
							checked={isNote}
							onCheckedChange={(checked) => setIsNote(checked === true)}
						/>
						{t("tickets.internalNote")}
					</Label>
					<Button
						type="submit"
						size="sm"
						className="ms-auto"
						disabled={draft.trim() === "" || addReply.isPending}
					>
						{t("tickets.send")}
					</Button>
				</div>
			</form>
		</section>
	);
}

// The thread opens on its newest entry, as a chat does, so the last bubble shows in full.
// A module function keeps the ref stable: it runs on mount only, not on each typed key.
function scrollToNewest(node: HTMLDivElement | null) {
	if (node) {
		node.scrollTop = node.scrollHeight;
	}
}

type ToolbarButtonProps = {
	/** The name of the action: the tooltip and the accessible name. */
	label: string;
	/** True draws the button as off, for example "Next" on the last ticket. */
	disabled?: boolean;
	/** One Link, button, or span with the icon. The ghost icon button wraps it. */
	children: ReactNode;
};

// A ghost icon button with a tooltip, as in the toolbar of the kit mail page.
function ToolbarButton({
	label,
	disabled = false,
	children,
}: ToolbarButtonProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					asChild
					variant="ghost"
					size="icon"
					aria-label={label}
					aria-disabled={disabled || undefined}
					className={disabled ? "pointer-events-none opacity-50" : undefined}
				>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}
