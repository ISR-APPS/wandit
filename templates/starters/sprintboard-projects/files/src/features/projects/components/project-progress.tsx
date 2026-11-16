// The progress of a project as a thin bar and a percent: done story points out of all story points.
// The project list and the project page render it.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

type ProjectProgressProps = {
	/** Story points of the done tasks. */
	pointsDone: number;
	/** Story points of every task of the project. */
	pointsTotal: number;
	/** Width classes of the bar, for example "w-24". */
	className?: string;
};

/** A project with no task shows 0 %. The percent is the accessible text; the bar is decoration. */
export function ProjectProgress({
	pointsDone,
	pointsTotal,
	className,
}: ProjectProgressProps) {
	const { locale } = useT();
	const ratio = pointsTotal === 0 ? 0 : pointsDone / pointsTotal;
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	return (
		<span className="flex items-center gap-2.5">
			<span
				aria-hidden="true"
				className={cn(
					"h-1.5 w-24 overflow-hidden rounded-full bg-muted",
					className,
				)}
			>
				<span
					className="block h-full rounded-full bg-primary"
					style={{ width: `${ratio * 100}%` }}
				/>
			</span>
			<span className="w-9 text-end font-medium text-sm tabular-nums">
				{percent.format(ratio)}
			</span>
		</span>
	);
}
