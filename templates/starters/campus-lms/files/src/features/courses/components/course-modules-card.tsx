// The rail card of the course page with the modules in order: the lesson count, the release, and the share done.
// CourseDetailPage renders it. A module with no open lesson shows the day its first lesson opens.
import {
	DISPLAY_CARD_TITLE,
	dateFormat,
	fillMessage,
	shareFormat,
} from "~/features/school";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { CheckCircleIcon } from "~/shared/ui/icons";
import { Progress } from "~/shared/ui/progress";
import type { CourseModule } from "../api/courses.queries";

type CourseModulesCardProps = {
	/** The modules of the course, in release order. */
	modules: CourseModule[];
};

/** The number before each module is its place in the course. A fully open and done module gets a check. */
export function CourseModulesCard({ modules }: CourseModulesCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const share = shareFormat(locale);
	const date = dateFormat(locale);

	return (
		<Card>
			<CardHeader>
				<CardTitle className={DISPLAY_CARD_TITLE}>
					{t("courses.modules")}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<ol className="grid gap-4">
					{modules.map((module, index) => {
						const isOpen = module.released > 0;
						// A count divided by the same count is exactly 1, so the check needs no tolerance.
						const isFinished =
							module.released === module.lessons && module.doneShare === 1;
						return (
							<li key={module.title} className="flex gap-3">
								<span
									aria-hidden="true"
									className={
										isOpen
											? "flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground text-xs tabular-nums"
											: "flex size-7 shrink-0 items-center justify-center rounded-full border border-border/30 font-semibold text-muted-foreground text-xs tabular-nums"
									}
								>
									{isFinished ? (
										<CheckCircleIcon className="size-4" />
									) : (
										number.format(index + 1)
									)}
								</span>
								<div className="grid min-w-0 flex-1 gap-1.5">
									<div className="flex items-baseline justify-between gap-3">
										<p className="truncate font-medium text-sm">
											{module.title}
										</p>
										<p className="shrink-0 text-muted-foreground text-xs tabular-nums">
											{/* A module that opens part by part says how many of its lessons are open. */}
											{fillMessage(
												t(
													isOpen && module.released < module.lessons
														? "courses.moduleLessonsOpen"
														: "courses.moduleLessons",
												),
												{
													released: number.format(module.released),
													count: number.format(module.lessons),
												},
											)}
										</p>
									</div>
									{isOpen ? (
										<>
											<Progress
												value={module.doneShare ?? 0}
												max={1}
												aria-label={module.title}
												className="h-1.5"
											/>
											<p className="text-muted-foreground text-xs tabular-nums">
												{fillMessage(t("courses.moduleDone"), {
													share: share.format(module.doneShare ?? 0),
												})}
											</p>
										</>
									) : (
										<p className="text-muted-foreground text-xs">
											{fillMessage(t("courses.moduleOpens"), {
												date: date.format(new Date(module.opensAt)),
											})}
										</p>
									)}
								</div>
							</li>
						);
					})}
				</ol>
			</CardContent>
		</Card>
	);
}
