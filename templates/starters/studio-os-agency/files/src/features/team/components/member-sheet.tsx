// The side panel of one member: the load of the period, the projects with their hours, and the last timesheet days.
// TeamPage opens it from a capacity row. It reads only the MemberLoad row; it saves nothing.
import { Link } from "@tanstack/react-router";
import { PersonAvatar, useFormatters } from "~/features/studio";
import { useT } from "~/shared/i18n";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "~/shared/ui/sheet";
import type { MemberLoad } from "../lib/team-load";

// A timesheet bar holds 10 hours, a long studio day. A longer day fills the bar.
const TIMESHEET_DAY_HOURS = 10;

/** The width of `hours` in a timesheet bar, as a CSS percent. */
function dayWidth(hours: number): string {
	return `${Math.min(1, hours / TIMESHEET_DAY_HOURS) * 100}%`;
}

type MemberSheetProps = {
	/** The member to show. It stays set while the sheet slides out, so the panel never closes empty. */
	member: MemberLoad | null;
	/** True while the sheet is open. */
	open: boolean;
	/** The period of the figures, in days. */
	days: number;
	onOpenChange: (open: boolean) => void;
};

/** A controlled sheet. It renders nothing inside until a member is chosen. */
export function MemberSheet({
	member,
	open,
	days,
	onOpenChange,
}: MemberSheetProps) {
	const { t } = useT();
	const format = useFormatters();
	return (
		<Sheet open={open && member !== null} onOpenChange={onOpenChange}>
			<SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
				{member ? (
					<>
						<SheetHeader className="gap-3 border-b p-6">
							<div className="flex items-center gap-3">
								<PersonAvatar name={member.name} className="size-11 text-sm" />
								<div className="grid">
									<SheetTitle className="font-display text-xl">
										{member.name}
									</SheetTitle>
									<SheetDescription>
										{t(`codes.roles.${member.role}`)}
									</SheetDescription>
								</div>
							</div>
						</SheetHeader>
						<div className="grid gap-6 p-6">
							<dl className="grid grid-cols-3 gap-3">
								{[
									{
										id: "utilization",
										label: t("team.utilization"),
										value: format.percent(member.utilization),
									},
									{
										id: "billable",
										label: t("team.billable"),
										value: format.hours(member.billable),
									},
									{
										id: "capacity",
										label: t("team.capacity"),
										value: format.hours(member.capacity),
									},
								].map((fact) => (
									<div
										key={fact.id}
										className="grid gap-1 rounded-control bg-muted/60 p-3"
									>
										<dt className="text-muted-foreground text-xs">
											{fact.label}
										</dt>
										<dd className="font-numeric font-semibold text-lg tabular-nums">
											{fact.value}
										</dd>
									</div>
								))}
							</dl>
							<section className="grid gap-3">
								<h2 className="font-semibold text-sm">
									{t("team.projectsInPeriod").replace(
										"{days}",
										format.number(days),
									)}
								</h2>
								{member.projects.length === 0 ? (
									<p className="text-muted-foreground text-sm">
										{t("team.noProjects")}
									</p>
								) : (
									<ul className="grid">
										{member.projects.map((project) => (
											<li
												key={project.projectId}
												className="flex items-center justify-between gap-3 border-b py-2.5 last:border-b-0"
											>
												<span className="grid min-w-0">
													<Link
														to="/app/projects/$projectId"
														params={{ projectId: project.projectId }}
														className="truncate font-medium text-sm hover:underline"
													>
														{project.projectName}
													</Link>
													<span className="truncate text-muted-foreground text-xs">
														{project.clientName}
													</span>
												</span>
												<span className="font-medium text-sm tabular-nums">
													{format.hours(project.hours)}
												</span>
											</li>
										))}
									</ul>
								)}
							</section>
							<section className="grid gap-3">
								<h2 className="font-semibold text-sm">{t("team.timesheet")}</h2>
								<ul className="grid gap-2">
									{member.recentDays.map((day) => (
										<li
											key={day.day}
											className="grid grid-cols-[5.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm"
										>
											<span className="text-muted-foreground tabular-nums">
												{format.shortDate(day.day)}
											</span>
											<span
												aria-hidden="true"
												className="flex h-2 rounded-sm bg-muted"
											>
												<span
													className="h-full rounded-s-sm bg-chart-1"
													style={{ width: dayWidth(day.billable) }}
												/>
												<span
													className="h-full rounded-e-sm bg-chart-2"
													style={{ width: dayWidth(day.studio) }}
												/>
											</span>
											<span className="text-end tabular-nums">
												{format.hours(day.billable + day.studio)}
											</span>
										</li>
									))}
								</ul>
							</section>
						</div>
					</>
				) : null}
			</SheetContent>
		</Sheet>
	);
}
