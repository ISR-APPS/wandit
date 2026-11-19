// The notes card of the Reports page, in the anatomy of the kit chat card: the teammate and a mail button
// in the header, the thread as bubbles, and a one-line form that adds a note. ReportsPage renders it fourth.
// It reads notesQueryOptions and writes with useAddNoteMutation. A note lasts for this browser session.
import { EnvelopeSimpleIcon, PaperPlaneRightIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { fillMessage, initialsOf } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardFooter,
	CardHeader,
} from "~/shared/ui/card";
import { Input } from "~/shared/ui/input";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/ui/tooltip";
import { useAddNoteMutation } from "../api/reports.mutations";
import { notesQueryOptions } from "../api/reports.queries";
import { NOTES_TEAMMATE } from "../lib/sample-reports";
import { noteSchema } from "../lib/schedule-schema";

/** The notes of the signed-in user sit at the end side on the primary color. The input clears after a save. */
export function NotesCard() {
	const { t, locale } = useT();
	const notes = useQuery(notesQueryOptions());
	const addNote = useAddNoteMutation();
	const [draft, setDraft] = useState("");
	// Intl throws a TypeError when timeStyle and weekday mix, so the time uses hour and minute fields.
	const time = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		hour: "numeric",
		minute: "2-digit",
	});
	const parsedDraft = noteSchema.safeParse(draft);
	const mailLabel = fillMessage(t("reports.notes.email"), {
		name: NOTES_TEAMMATE.name,
	});

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		// The button is off for an empty or too long draft. Enter can still submit, so parse again.
		if (!parsedDraft.success) {
			return;
		}
		addNote.mutate(parsedDraft.data, {
			onSuccess: () => setDraft(""),
			onError: () => toast.error(t("reports.notes.saveError")),
		});
	}

	return (
		<Card className="h-full">
			<CardHeader>
				<div className="flex min-w-0 items-center gap-4">
					<Avatar>
						<AvatarFallback>{initialsOf(NOTES_TEAMMATE.name)}</AvatarFallback>
					</Avatar>
					<div className="min-w-0">
						<p className="truncate font-medium text-sm leading-none">
							{NOTES_TEAMMATE.name}
						</p>
						<p className="truncate text-muted-foreground text-sm">
							{NOTES_TEAMMATE.email}
						</p>
					</div>
				</div>
				<CardAction>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								className="rounded-full"
								asChild
							>
								<a
									href={`mailto:${NOTES_TEAMMATE.email}`}
									aria-label={mailLabel}
								>
									<EnvelopeSimpleIcon />
								</a>
							</Button>
						</TooltipTrigger>
						<TooltipContent>{mailLabel}</TooltipContent>
					</Tooltip>
				</CardAction>
			</CardHeader>
			<CardContent>
				{notes.isError ? (
					<p className="text-sm" role="alert">
						{t("reports.notes.error")}
					</p>
				) : notes.data === undefined ? (
					<Skeleton className="h-48" />
				) : notes.data.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("reports.notes.empty")}
					</p>
				) : (
					// grid-cols-1 gives the column the card width, so the 75% bubble limit resolves against it.
					<ul
						className="grid grid-cols-1 gap-4"
						aria-label={t("reports.notes.title")}
					>
						{notes.data.map((note) => (
							<li
								key={note.id}
								className={cn(
									"grid w-max max-w-[75%] gap-1 rounded-lg px-3 py-2 text-sm",
									note.authorName === null
										? "ms-auto bg-primary text-primary-foreground"
										: "bg-muted",
								)}
							>
								<p className="break-words">{note.text}</p>
								<time dateTime={note.at} className="text-xs opacity-70">
									{note.authorName === null
										? time.format(new Date(note.at))
										: `${note.authorName} · ${time.format(new Date(note.at))}`}
								</time>
							</li>
						))}
					</ul>
				)}
			</CardContent>
			<CardFooter>
				<form onSubmit={submit} className="flex w-full items-center gap-2">
					<Input
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						placeholder={t("reports.notes.placeholder")}
						aria-label={t("reports.notes.placeholder")}
						autoComplete="off"
						maxLength={500}
						className="flex-1"
					/>
					<Button
						type="submit"
						size="icon"
						aria-label={t("reports.notes.send")}
						disabled={!parsedDraft.success || addNote.isPending}
					>
						<PaperPlaneRightIcon className="rtl:-scale-x-100" />
					</Button>
				</form>
			</CardFooter>
		</Card>
	);
}
