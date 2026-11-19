// The leaderboard of the home: the 4 students with the most grade points in the running courses.
// DashboardPage renders it at the end of the top band. Each name opens the record of the student.
import { Link } from "@tanstack/react-router";
import { fillMessage, PersonAvatar } from "~/features/school";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import type { Leader } from "../api/dashboard.queries";

type LeaderboardCardProps = {
	/** The top students, most points first, from the summary query. */
	leaders: Leader[];
};

/** A ranked list. The arrow button opens the Students page. */
export function LeaderboardCard({ leaders }: LeaderboardCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("dashboard.leaderboard")}</CardTitle>
				<CardAction>
					<Button variant="outline" size="icon" asChild>
						<Link to="/app/students" aria-label={t("dashboard.allStudents")}>
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{leaders.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("dashboard.noLeaders")}
					</p>
				) : (
					<ol className="grid gap-4">
						{leaders.map((leader, index) => (
							<li key={leader.id} className="flex items-center gap-3">
								<span className="w-5 text-sm tabular-nums">{`${number.format(index + 1)}.`}</span>
								<PersonAvatar name={leader.name} className="size-9" />
								<Link
									to="/app/students"
									search={{ student: leader.id }}
									className="min-w-0 flex-1 font-medium text-sm hover:underline"
								>
									{leader.name}
								</Link>
								<Badge variant="outline" className="tabular-nums">
									{fillMessage(t("dashboard.points"), {
										points: number.format(leader.points),
									})}
								</Badge>
							</li>
						))}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}
