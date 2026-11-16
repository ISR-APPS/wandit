// The state of a project in one badge: the health of an active project, else its status.
// The project list, the project page, and the overview breakdown render it.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import {
	PROJECT_HEALTH_BADGE,
	PROJECT_STATUS_BADGE,
	type ProjectHealth,
	type ProjectStatus,
} from "../lib/codes";

type ProjectStateBadgeProps = {
	status: ProjectStatus;
	/** Set only on an active project. */
	health: ProjectHealth | null;
};

/** "On track", "At risk", or "Off track" for an active project; "Planned", "Paused", or "Completed" for the others. */
export function ProjectStateBadge({ status, health }: ProjectStateBadgeProps) {
	const { t } = useT();
	if (health === null) {
		return (
			<Badge variant={PROJECT_STATUS_BADGE[status]}>
				{t(`projectStatus.${status}`)}
			</Badge>
		);
	}
	const variant = PROJECT_HEALTH_BADGE[health];
	return (
		<Badge
			variant={variant}
			// The destructive variant is solid red. This gives it the tinted look of success and warning.
			className={cn(
				variant === "destructive" &&
					"border-destructive/25 bg-destructive/12 text-destructive hover:bg-destructive/12",
			)}
		>
			{t(`health.${health}`)}
		</Badge>
	);
}
