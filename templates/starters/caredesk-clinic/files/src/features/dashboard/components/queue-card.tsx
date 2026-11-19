// The queue card of the home: the next patients of today with their time, and a field that adds a walk-in.
// DashboardPage renders it second in the row of 3 of the Overview tab, with every appointment of the book.
// A walk-in stays in the state of the card only. It is gone after a reload, as STARTER.md says.
import { ClockIcon, PlusCircleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { type AppointmentRow, isLate } from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Input } from "~/shared/ui/input";
import { queueWindow } from "../lib/queue";

// The card lists 7 rows, as the kit list card does.
const QUEUE_SIZE = 7;
// A name longer than this is a paste error, not a person.
const WALK_IN_MAX_LENGTH = 80;

/** One walk-in that the front desk typed in this session. */
type WalkIn = {
	id: string;
	name: string;
	/** When the desk added the walk-in, in milliseconds since 1970. */
	at: number;
};

type QueueCardProps = {
	/** Every appointment of the book, oldest first. */
	rows: AppointmentRow[];
	/** The current time in milliseconds since 1970, from useNow(). */
	now: number;
};

/** A seen patient or a no-show stays in the window, muted, so the desk sees where the day stands. */
export function QueueCard({ rows, now }: QueueCardProps) {
	const { t, locale } = useT();
	const [walkIns, setWalkIns] = useState<WalkIn[]>([]);
	const [name, setName] = useState("");
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const queue = queueWindow(rows, now, QUEUE_SIZE);

	function addWalkIn(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const trimmed = name.trim();
		if (trimmed === "") {
			return;
		}
		setWalkIns((current) => [
			...current,
			{ id: `walk-in-${current.length + 1}`, name: trimmed, at: Date.now() },
		]);
		setName("");
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("dashboard.queueTitle")}</CardTitle>
			</CardHeader>
			<CardContent className="flex-1">
				{queue.length === 0 && walkIns.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						{t("dashboard.queueEmpty")}
					</p>
				) : (
					<ul className="divide-y">
						{queue.map((row) => {
							const isDone =
								row.status === "completed" || row.status === "no_show";
							return (
								<li key={row.id}>
									<Link
										to="/app/appointments"
										search={{ appointment: row.id }}
										className={cn(
											"flex h-12 items-center justify-between gap-3 text-sm outline-none hover:opacity-70 focus-visible:underline",
											isDone && "text-muted-foreground",
										)}
									>
										<span className="truncate" dir="auto">
											{`${row.patient.fullName} · ${t(`visitTypes.${row.visitType}`)}`}
										</span>
										<span
											className={cn(
												"flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs tabular-nums",
												isLate(row, now) && "font-medium text-warning",
											)}
										>
											<ClockIcon className="size-3" />
											{time.format(row.startsAt)}
										</span>
									</Link>
								</li>
							);
						})}
						{walkIns.map((walkIn) => (
							<li
								key={walkIn.id}
								className="flex h-12 items-center justify-between gap-3 text-sm"
							>
								<span className="truncate" dir="auto">
									{`${walkIn.name} · ${t("dashboard.walkIn")}`}
								</span>
								<span className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs tabular-nums">
									<ClockIcon className="size-3" />
									{time.format(walkIn.at)}
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
			<CardFooter>
				<form onSubmit={addWalkIn} className="relative w-full">
					<Input
						value={name}
						onChange={(event) => setName(event.target.value)}
						maxLength={WALK_IN_MAX_LENGTH}
						placeholder={t("dashboard.walkInPlaceholder")}
						aria-label={t("dashboard.walkInPlaceholder")}
						className="pe-20"
					/>
					<Button
						type="submit"
						variant="secondary"
						size="sm"
						className="absolute end-1 top-1/2 h-7 -translate-y-1/2"
					>
						<PlusCircleIcon />
						{t("dashboard.add")}
					</Button>
				</form>
			</CardFooter>
		</Card>
	);
}
