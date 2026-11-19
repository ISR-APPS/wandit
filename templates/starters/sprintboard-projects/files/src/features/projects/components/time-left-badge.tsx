// The time badge of a project card: "2 weeks left", "3 days late", "Starts in 12 days", "Completed", or "Paused".
// ProjectsPage renders it at the end of each card. The color follows the health of an active project.
import { fillMessage, type ProjectHealth, pluralOf } from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import type { ProjectTimeLeft } from "../lib/project-progress";

// From 14 days the badge counts whole weeks, as a planning horizon. Under it, it counts days.
const WEEK_COUNT_FROM_DAYS = 14;

// The tinted destructive look of the off-track and late badges. The kit Badge has no tinted destructive variant.
const DESTRUCTIVE_TINT =
	"border-destructive/25 bg-destructive/12 text-destructive";

type TimeLeftBadgeProps = {
	time: ProjectTimeLeft;
	/** The health of an active project, else null. It colors a "left" badge. */
	health: ProjectHealth | null;
};

/** A late project is always red. A running project takes the color of its health. */
export function TimeLeftBadge({ time, health }: TimeLeftBadgeProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	if (time.kind === "completed" || time.kind === "paused") {
		return (
			<Badge variant={time.kind === "completed" ? "info" : "secondary"}>
				{t(`projectStatus.${time.kind}`)}
			</Badge>
		);
	}
	const inWeeks = time.days >= WEEK_COUNT_FROM_DAYS;
	const count = inWeeks ? Math.round(time.days / 7) : time.days;
	const unit = inWeeks ? "weeks" : "days";
	const text = fillMessage(
		t(`projects.time.${time.kind}.${unit}.${pluralOf(count, locale)}`),
		{ count: number.format(count) },
	);
	if (time.kind === "starts") {
		return <Badge variant="outline">{text}</Badge>;
	}
	const variant =
		time.kind === "late" || health === "off-track"
			? "outline"
			: health === "at-risk"
				? "warning"
				: "success";
	return (
		<Badge
			variant={variant}
			className={cn(variant === "outline" && DESTRUCTIVE_TINT)}
		>
			{text}
		</Badge>
	);
}
