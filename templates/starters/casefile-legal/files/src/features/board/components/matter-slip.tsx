// One slip of the board, drawn as a file folder: a tab with the file number, then the matter name,
// the client, the next deadline, the lead attorney, and the age in the stage.
// BoardColumn renders one slip per matter. The slip is a link to the matter page.
import { CalendarBlankIcon, FlagPennantIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { MatterSummary } from "~/features/matters";
import {
	formatAge,
	formatRelativeTime,
	PersonAvatar,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import { hasSoonDeadline } from "../lib/board";

type MatterSlipProps = {
	matter: MatterSummary;
	/** The current time in milliseconds since 1970. The age and the deadline count from it. */
	now: number;
};

/** A deadline within a week shows a flag in the warning color. An ended matter shows no deadline line. */
export function MatterSlip({ matter, now }: MatterSlipProps) {
	const { t, locale } = useT();
	const isSoon = hasSoonDeadline(matter, now);
	const isOpen = matter.closedAt === null;
	return (
		<Link
			to="/app/matters/$matterId"
			params={{ matterId: matter.id }}
			// relative: the sr-only texts are absolute. Without it they escape the board and widen the page.
			className="group relative grid rounded-surface outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
		>
			{/* The folder tab: the file number of the firm. -mb-px lets it cover the top rule of the body. */}
			<span className="relative z-10 ms-3 -mb-px w-fit rounded-t-md border border-b-0 bg-card px-2 pt-0.5 font-numeric text-muted-foreground text-xs tabular-nums transition-colors group-hover:border-ring">
				{matter.number}
			</span>
			<span className="grid gap-3 rounded-surface border bg-card p-3 transition-colors group-hover:border-ring">
				<span className="grid justify-items-start gap-0.5">
					<span
						className="line-clamp-2 font-display font-semibold text-sm leading-snug"
						dir="auto"
					>
						{matter.name}
					</span>
					<span
						className="max-w-full truncate text-muted-foreground text-xs"
						dir="auto"
					>
						{matter.clientName}
					</span>
				</span>
				{isOpen ? (
					matter.nextDeadline ? (
						// Two fixed lines, the title and the time, so all slips keep one shape.
						<span
							className={
								isSoon
									? "flex items-start gap-1.5 text-warning text-xs"
									: "flex items-start gap-1.5 text-muted-foreground text-xs"
							}
						>
							{isSoon ? (
								<FlagPennantIcon className="mt-px size-3.5 shrink-0" />
							) : (
								<CalendarBlankIcon className="mt-px size-3.5 shrink-0" />
							)}
							<span className="grid min-w-0 justify-items-start">
								{isSoon ? (
									<span className="sr-only">{t("board.deadlineSoon")} </span>
								) : null}
								{/* Two lines at most: the title says what is due, so a cut after a few words hides it. */}
								<span className="line-clamp-2" dir="auto">
									{matter.nextDeadline.title}
								</span>
								<span className="font-medium">
									{formatRelativeTime(matter.nextDeadline.dueAt, now, locale)}
								</span>
							</span>
						</span>
					) : (
						<span className="text-muted-foreground text-xs">
							{t("board.noDeadline")}
						</span>
					)
				) : null}
				<span className="flex items-center justify-between gap-2 border-t border-dashed pt-2.5">
					<span className="flex min-w-0 items-center gap-1.5">
						<PersonAvatar
							name={matter.leadName}
							className="size-5 text-[0.5625rem]"
						/>
						<span className="truncate text-muted-foreground text-xs">
							{matter.leadName}
						</span>
					</span>
					<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
						{formatAge(matter.stageChangedAt, now, locale)}
						<span className="sr-only"> {t("board.inStage")}</span>
					</span>
				</span>
			</span>
		</Link>
	);
}
