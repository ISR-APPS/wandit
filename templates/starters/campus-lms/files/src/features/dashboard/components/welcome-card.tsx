// The welcome card of the home: a greeting, one sentence with the figures of today, and a link to the courses.
// DashboardPage renders it first, over half of the top band. The end third lists the classes of today.
// It reads only its props. The kit puts an illustration in the end third; the classes of today replace it.
import { Link } from "@tanstack/react-router";
import { fillMessage, formatClassTime } from "~/features/school";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import type { ClassToday } from "../api/dashboard.queries";

type WelcomeCardProps = {
	/** Count of courses with the status running, from the summary query. */
	runningCourses: number;
	/** Count of submissions with no grade. */
	toGrade: number;
	/** The running courses that meet today, from the summary query. */
	classesToday: ClassToday[];
};

// The end third has room for 3 classes. The count names the rest.
const SHOWN_CLASSES = 3;

/** Two columns from 32rem of card width. On a phone the classes of today go under the text. */
export function WelcomeCard({
	runningCourses,
	toGrade,
	classesToday,
}: WelcomeCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const hidden = classesToday.length - SHOWN_CLASSES;

	return (
		<Card className="@container/welcome h-full">
			<CardContent className="grid h-full @lg/welcome:grid-cols-5 items-center gap-6">
				<div className="@lg/welcome:col-span-3 grid gap-4">
					<p className="font-(--heading-weight) font-display text-3xl tracking-(--heading-tracking)">
						{t("dashboard.welcome")}
					</p>
					<p className="text-2xl leading-snug">
						{fillMessage(t("dashboard.welcomeFigures"), {
							running: number.format(runningCourses),
							toGrade: number.format(toGrade),
						})}
					</p>
					<p className="text-muted-foreground">{t("dashboard.welcomeText")}</p>
					<div className="pt-2">
						<Button asChild>
							<Link to="/app/courses">{t("dashboard.openCourses")}</Link>
						</Button>
					</div>
				</div>
				<div className="@lg/welcome:col-span-2 grid gap-2 rounded-md bg-muted p-4">
					<p className="font-medium text-sm">{t("dashboard.classesToday")}</p>
					{classesToday.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							{t("dashboard.noClassToday")}
						</p>
					) : (
						<ul className="grid gap-2">
							{classesToday.slice(0, SHOWN_CLASSES).map((item) => (
								<li key={item.courseId}>
									<Link
										to="/app/courses/$courseId"
										params={{ courseId: item.courseId }}
										className="grid gap-0.5 rounded-md bg-card px-3 py-2 text-sm transition-colors hover:bg-accent"
									>
										<span className="font-medium">{item.title}</span>
										<span className="text-muted-foreground text-xs tabular-nums">
											{`${item.code} · ${formatClassTime(item.classTime, locale)}`}
										</span>
									</Link>
								</li>
							))}
							{hidden > 0 ? (
								<li className="text-muted-foreground text-xs">
									{fillMessage(t("dashboard.moreClasses"), {
										count: number.format(hidden),
									})}
								</li>
							) : null}
						</ul>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
