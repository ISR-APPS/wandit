// The status of a task as a word in a colored badge: Backlog, To do, In progress, In review, Done.
// The recent tasks card, the task dialog, and the Team member sheet render it. The board shows the status as its column instead.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { TASK_STATUS_BADGE, type TaskStatus } from "../lib/codes";

/** The word always shows with the color, so the status never depends on color alone. */
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
	const { t } = useT();
	return (
		<Badge variant={TASK_STATUS_BADGE[status]}>{t(`status.${status}`)}</Badge>
	);
}
