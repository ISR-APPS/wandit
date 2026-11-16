// One colleague on a profile: the avatar, a link to their profile, the job title, and a status badge.
// EmployeeProfilePage renders it for the manager and for each direct report.
import { Link } from "@tanstack/react-router";
import { EMPLOYEE_STATUS_BADGE, PersonAvatar } from "~/features/people";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import type { PersonLink } from "../api/employees.queries";

type PersonRowProps = {
	/** The manager or a report, as the profile query returns them. */
	person: PersonLink;
};

/** The badge shows only for a status other than "active", so the rare cases stand out. */
export function PersonRow({ person }: PersonRowProps) {
	const { t } = useT();
	return (
		<div className="flex items-center gap-3">
			<PersonAvatar name={person.name} />
			{/* max-w-full lets a long name or title truncate inside this start-aligned column. */}
			<div className="grid min-w-0 flex-1 justify-items-start">
				<Link
					to="/app/employees/$employeeId"
					params={{ employeeId: person.id }}
					className="max-w-full truncate font-medium text-sm hover:underline"
					dir="auto"
				>
					{person.name}
				</Link>
				<span
					className="max-w-full truncate text-muted-foreground text-xs"
					dir="auto"
				>
					{person.title}
				</span>
			</div>
			{person.status === "active" ? null : (
				<Badge variant={EMPLOYEE_STATUS_BADGE[person.status]}>
					{t(`employeeStatuses.${person.status}`)}
				</Badge>
			)}
		</div>
	);
}
