// The color mark and the name of a time-off type, for legends, table cells, and lists.
// The time-off page, the overview, and the profile render it. The color matches the charts and the planner.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { TIME_OFF_TYPE_COLOR, type TimeOffType } from "../lib/codes";

type TimeOffTypeMarkProps = {
	/** The leave type of a request. It picks the dot color and the `timeOffTypes.<type>` label. */
	type: TimeOffType;
	/** Hides the name and keeps the mark, for a legend that names the type elsewhere. */
	hideLabel?: boolean;
	/** Text classes of the caller, for example the muted size of a table cell. */
	className?: string;
};

/** A small dot in the type color, then the translated type name. */
export function TimeOffTypeMark({
	type,
	hideLabel = false,
	className,
}: TimeOffTypeMarkProps) {
	const { t } = useT();
	return (
		<span className={cn("inline-flex items-center gap-2", className)}>
			<span
				className="size-2.5 shrink-0 rounded-badge"
				style={{ background: TIME_OFF_TYPE_COLOR[type] }}
				aria-hidden
			/>
			{hideLabel ? null : <span>{t(`timeOffTypes.${type}`)}</span>}
		</span>
	);
}
