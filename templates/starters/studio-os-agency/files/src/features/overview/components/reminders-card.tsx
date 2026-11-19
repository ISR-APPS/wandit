// The reminders band of the home: the deliverables due in the next 14 days, three cards in a row.
// OverviewPage renders it over two columns of the third band. Each card links to the project of the deliverable.
// "Show the other N" opens the rest in the same grid; it changes no query.
import {
	ArrowRightIcon,
	CheckCircleIcon,
	KanbanIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { fillMessage, PRIORITY_DOT, useFormatters } from "~/features/studio";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { Reminder } from "../lib/overview-data";

// The kit shows one row of three reminders before "Show the other N".
const SHOWN_REMINDERS = 3;

type RemindersCardProps = {
	/** Deliverables due today or in the next 14 days, the nearest first. */
	reminders: Reminder[];
};

/** An approved deliverable shows a green check; an open one shows a muted check. */
export function RemindersCard({ reminders }: RemindersCardProps) {
	const { t, locale } = useT();
	const [isOpen, setIsOpen] = useState(false);
	const shown = isOpen ? reminders : reminders.slice(0, SHOWN_REMINDERS);
	const hiddenCount = reminders.length - SHOWN_REMINDERS;

	return (
		<Card className="@4xl/main:col-span-2">
			<CardHeader>
				<CardTitle>{t("overview.reminders.title")}</CardTitle>
				<CardAction>
					<Button variant="outline" size="sm" asChild>
						<Link to="/app/projects">
							<KanbanIcon />
							{t("overview.reminders.allProjects")}
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{reminders.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("overview.reminders.empty")}
					</p>
				) : (
					<ul className="grid @3xl/main:grid-cols-3 gap-4">
						{shown.map((reminder) => (
							<li key={reminder.id}>
								<ReminderItem reminder={reminder} />
							</li>
						))}
					</ul>
				)}
				{hiddenCount > 0 ? (
					<div className="mt-4 text-end">
						<Button
							variant="link"
							className="text-muted-foreground hover:text-primary"
							onClick={() => setIsOpen((open) => !open)}
							aria-expanded={isOpen}
						>
							{isOpen
								? t("overview.reminders.showFewer")
								: fillMessage(t("overview.reminders.showOthers"), {
										count: new Intl.NumberFormat(locale).format(hiddenCount),
									})}
							<ArrowRightIcon
								className={cn(
									"size-4 rtl:rotate-180",
									isOpen && "-rotate-90 rtl:-rotate-90",
								)}
							/>
						</Button>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

/** One reminder: the priority dot and word ("Approved" when done), the due day, the deliverable, and the service tag. */
function ReminderItem({ reminder }: { reminder: Reminder }) {
	const { t } = useT();
	const { relativeDay, shortDate } = useFormatters();
	const isDone = reminder.status === "approved";
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 font-semibold text-base">
					<span
						className={cn(
							"size-2 rounded-full",
							reminder.priority === null
								? "bg-success"
								: PRIORITY_DOT[reminder.priority],
						)}
					/>
					{reminder.priority === null
						? t("overview.reminders.done")
						: t(`codes.priorities.${reminder.priority}`)}
					<CheckCircleIcon
						className={cn(
							"ms-auto size-4",
							isDone ? "text-success" : "text-muted-foreground",
						)}
						aria-label={t(
							isDone
								? "overview.reminders.done"
								: `codes.deliverables.${reminder.status}`,
						)}
					/>
				</CardTitle>
			</CardHeader>
			<CardContent className="grid justify-items-start gap-4">
				<p className="text-muted-foreground text-sm">
					{`${relativeDay(reminder.dueDay)}, ${shortDate(reminder.dueDay)}`}
				</p>
				<Link
					to="/app/projects/$projectId"
					params={{ projectId: reminder.projectId }}
					className="text-sm hover:underline"
				>
					{fillMessage(t("overview.reminders.note"), {
						deliverable: reminder.name,
						project: reminder.projectName,
					})}
				</Link>
				<Badge variant="outline">
					{t(`codes.services.${reminder.service}`)}
				</Badge>
			</CardContent>
		</Card>
	);
}
