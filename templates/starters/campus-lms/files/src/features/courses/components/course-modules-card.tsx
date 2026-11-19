// The module list of the course page: one boxed row per module with a round state mark,
// as the "Course completion" list of the kit course page. CourseDetailPage renders it in the Modules tab.
// The module that is open now gets the primary border; a module with no open lesson shows its first day.
import {
	CheckIcon,
	type Icon,
	LockSimpleIcon,
	PlayIcon,
} from "@phosphor-icons/react";
import { dateFormat, fillMessage, shareFormat } from "~/features/school";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { CourseModule } from "../api/courses.queries";

/** The state of one module: every lesson open, some open, or none open yet. */
type ModuleState = "open" | "current" | "locked";

/** The round mark of each state. */
const MODULE_MARK = {
	open: { icon: CheckIcon, className: "bg-success/15 text-success" },
	current: { icon: PlayIcon, className: "bg-primary text-primary-foreground" },
	locked: { icon: LockSimpleIcon, className: "bg-muted" },
} satisfies Record<ModuleState, { icon: Icon; className: string }>;

function moduleStateOf(module: CourseModule): ModuleState {
	if (module.released === 0) {
		return "locked";
	}
	return module.released < module.lessons ? "current" : "open";
}

type CourseModulesCardProps = {
	/** The modules in course order, from the course query. */
	modules: CourseModule[];
};

/** The count at the end of the header is the modules with every lesson open, of all modules. */
export function CourseModulesCard({ modules }: CourseModulesCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const share = shareFormat(locale);
	const dates = dateFormat(locale);
	const openCount = modules.filter(
		(module) => moduleStateOf(module) === "open",
	).length;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("courses.modules")}</CardTitle>
				<CardAction>
					<span className="text-muted-foreground text-sm tabular-nums">
						{`${number.format(openCount)}/${number.format(modules.length)}`}
					</span>
				</CardAction>
			</CardHeader>
			<CardContent>
				<ol className="grid gap-2">
					{modules.map((module) => {
						const state = moduleStateOf(module);
						const mark = MODULE_MARK[state];
						const lessons = fillMessage(t("courses.moduleLessons"), {
							count: number.format(module.lessons),
						});
						return (
							<li
								key={module.title}
								className={cn(
									"flex items-center gap-3 rounded-lg border p-3",
									state === "current" && "border-primary bg-primary/5",
								)}
							>
								<span
									aria-hidden="true"
									className={cn(
										"flex size-8 shrink-0 items-center justify-center rounded-full",
										mark.className,
									)}
								>
									<mark.icon className="size-4 rtl:-scale-x-100" />
								</span>
								<div className="grid min-w-0 flex-1">
									<p className="font-medium">{module.title}</p>
									<p className="text-muted-foreground text-sm">
										{state === "locked"
											? `${lessons} · ${fillMessage(t("courses.moduleOpens"), {
													date: dates.format(new Date(module.opensAt)),
												})}`
											: `${lessons} · ${fillMessage(t("courses.moduleDone"), {
													share:
														module.doneShare === null
															? "–"
															: share.format(module.doneShare),
												})}`}
									</p>
								</div>
							</li>
						);
					})}
				</ol>
			</CardContent>
		</Card>
	);
}
