// The side panel of one team member: the load, three counts, and the open tasks in work order.
// TeamPage opens it from a row of the table. A task row links to the page of its project.
import { Link } from "@tanstack/react-router";
import {
	CapacityMeter,
	fillMessage,
	PersonAvatar,
	PriorityMark,
	TaskStatusBadge,
} from "~/features/tracker";
import { useT } from "~/shared/i18n";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "~/shared/ui/sheet";
import { OUTPUT_DAYS, type WorkloadRow } from "../lib/workload";

type MemberSheetProps = {
	/** The open row. null closes the sheet. */
	row: WorkloadRow | null;
	/** Runs with false when the user closes the sheet. */
	onOpenChange: (open: boolean) => void;
};

/** The sheet opens at the end side: on the right in English, on the left in Arabic. */
export function MemberSheet({ row, onOpenChange }: MemberSheetProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	return (
		<Sheet open={row !== null} onOpenChange={onOpenChange}>
			<SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
				{row ? (
					<>
						<SheetHeader className="gap-3 border-b p-6">
							<div className="flex items-center gap-3">
								<PersonAvatar
									name={row.member.name}
									className="size-11 text-sm"
								/>
								<div className="grid gap-0.5">
									<SheetTitle>
										<bdi>{row.member.name}</bdi>
									</SheetTitle>
									<SheetDescription>{row.member.role}</SheetDescription>
								</div>
							</div>
							<div className="grid gap-1.5">
								<span className="text-muted-foreground text-sm tabular-nums">
									{fillMessage(t("team.committedOf"), {
										points: number.format(row.committedPoints),
										capacity: number.format(row.member.capacity),
									})}
								</span>
								<CapacityMeter
									points={row.committedPoints}
									capacity={row.member.capacity}
									className="w-full"
								/>
							</div>
							<dl className="grid grid-cols-3 gap-3 pt-1">
								{[
									{ label: t("team.open"), value: row.openTasks.length },
									{ label: t("team.overdue"), value: row.overdueCount },
									{
										label: fillMessage(t("team.doneShort"), {
											days: number.format(OUTPUT_DAYS),
										}),
										value: row.doneCount,
									},
								].map((fact) => (
									<div key={fact.label} className="grid gap-0.5">
										<dt className="label-text text-muted-foreground text-xs">
											{fact.label}
										</dt>
										<dd className="font-numeric font-semibold text-lg tabular-nums">
											{number.format(fact.value)}
										</dd>
									</div>
								))}
							</dl>
						</SheetHeader>
						<div className="grid gap-2 p-4">
							<h3 className="px-2 font-semibold text-sm">
								{t("team.openTasks")}
							</h3>
							{row.openTasks.length === 0 ? (
								<p className="px-2 text-muted-foreground text-sm">
									{t("team.noOpenTasks")}
								</p>
							) : (
								<ul className="grid">
									{row.openTasks.map((task) => (
										<li key={task.id}>
											<Link
												to="/app/projects/$projectId"
												params={{ projectId: task.projectId }}
												className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-control px-2 py-2.5 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
											>
												<PriorityMark priority={task.priority} />
												<span className="grid min-w-0 gap-0.5">
													<span
														className="truncate font-medium text-sm"
														dir="auto"
													>
														{task.title}
													</span>
													<span className="truncate text-muted-foreground text-xs">
														<span className="tabular-nums">{task.key}</span> ·{" "}
														{task.projectName}
													</span>
												</span>
												<TaskStatusBadge status={task.status} />
											</Link>
										</li>
									))}
								</ul>
							)}
						</div>
					</>
				) : null}
			</SheetContent>
		</Sheet>
	);
}
