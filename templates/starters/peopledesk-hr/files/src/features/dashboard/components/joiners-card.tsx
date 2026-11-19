// The joiners card of the home: the five people who started last, with their email and a team badge.
// DashboardPage renders it first in the middle grid with the employee list of the /app loader.
// It follows the team members card of the kit: an avatar, two text lines, and one control at the row end.
import { ArrowRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { EmployeeListItem } from "~/features/employees";
import { PersonAvatar } from "~/features/people";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

// Five rows keep the card as tall as the funnel card beside it.
const SHOWN_JOINERS = 5;

type JoinersCardProps = {
	/** Every employee. The card sorts them by start date, the latest first. */
	employees: EmployeeListItem[];
};

/** The name opens the profile. The badge names the team, so the row needs no color. */
export function JoinersCard({ employees }: JoinersCardProps) {
	const { t } = useT();
	const joiners = [...employees]
		.sort((first, second) => second.startDate.localeCompare(first.startDate))
		.slice(0, SHOWN_JOINERS);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("dashboard.joinersTitle")}</CardTitle>
				<CardDescription>{t("dashboard.joinersDescription")}</CardDescription>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<Link to="/app/employees">
							{t("common.viewAll")}
							<ArrowRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid content-start gap-6">
				{joiners.map((employee) => (
					<div
						key={employee.id}
						className="flex min-w-0 items-center justify-between gap-4"
					>
						<div className="flex min-w-0 flex-1 items-center gap-4">
							<PersonAvatar name={employee.name} className="size-9 shrink-0" />
							<div className="grid min-w-0 flex-1 gap-1">
								<Link
									to="/app/employees/$employeeId"
									params={{ employeeId: employee.id }}
									className="truncate font-medium text-sm leading-none hover:underline"
									dir="auto"
								>
									{employee.name}
								</Link>
								<p className="truncate text-muted-foreground text-sm">
									{employee.email}
								</p>
							</div>
						</div>
						<Badge variant="outline" className="shrink-0">
							{t(`departmentsShort.${employee.department}`)}
						</Badge>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
