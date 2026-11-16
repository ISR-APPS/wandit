// One position as a selectable card: the title, the department, the status, the age, and a bar of its pipeline.
// HiringPage renders one per position. A click puts the position in the URL, and the board below shows it.
import {
	BOARD_STAGES,
	calendarDaysFromNow,
	POSITION_STATUS_BADGE,
	toDayKey,
} from "~/features/people";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import type { Position } from "../api/hiring.queries";
import { STAGE_FILL } from "../lib/stage-fill";

type PositionCardProps = {
	/** One row of positionsQueryOptions, with the candidate count of each board stage. */
	position: Position;
	/** True for the position in ?position= of the URL, or the first position when the URL has none. */
	isSelected: boolean;
	/** Writes ?position= to the URL; the board below then shows this position. */
	onSelect: () => void;
};

/** A button card. aria-pressed marks the chosen position. */
export function PositionCard({
	position,
	isSelected,
	onSelect,
}: PositionCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const dayCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const inProcess = BOARD_STAGES.filter((stage) => stage !== "hired").reduce(
		(sum, stage) => sum + position.stageCounts[stage],
		0,
	);
	const onBoard = BOARD_STAGES.reduce(
		(sum, stage) => sum + position.stageCounts[stage],
		0,
	);
	// An open position counts its days until today; a closed one until its close day.
	const now = Date.now();
	const daysOpen =
		calendarDaysFromNow(position.closedAt ?? toDayKey(new Date(now)), now) -
		calendarDaysFromNow(position.openedAt, now);

	return (
		<button
			type="button"
			aria-pressed={isSelected}
			onClick={onSelect}
			className={cn(
				// The title row takes the free height, so the bars and the figures of one card row line up.
				"grid grid-rows-[auto_1fr_auto_auto] gap-3 rounded-surface border border-border bg-card p-4 text-start shadow-surface transition-colors hover:bg-accent/40",
				isSelected && "bg-accent/50 ring-2 ring-ring",
			)}
		>
			<div className="flex items-start justify-between gap-2">
				<span className="text-muted-foreground text-xs tabular-nums">
					{`${position.id} · ${t(`departments.${position.department}`)}`}
				</span>
				<Badge variant={POSITION_STATUS_BADGE[position.status]}>
					{t(`positionStatuses.${position.status}`)}
				</Badge>
			</div>
			<div className="grid content-start gap-0.5">
				<span className="font-medium leading-snug">{position.title}</span>
				<span className="text-muted-foreground text-sm">
					{`${t(`locations.${position.location}`)} · ${dayCount.format(daysOpen)}`}
				</span>
			</div>
			<div className="flex h-1.5 gap-0.5 overflow-hidden rounded-badge bg-muted">
				{onBoard > 0
					? BOARD_STAGES.map((stage) =>
							position.stageCounts[stage] > 0 ? (
								<span
									key={stage}
									className={STAGE_FILL[stage]}
									style={{ flexGrow: position.stageCounts[stage] }}
								/>
							) : null,
						)
					: null}
			</div>
			<dl className="grid grid-cols-2 gap-2 text-sm">
				<div className="grid">
					{/* A paused post holds its candidates. The page figure "In process" counts open posts only. */}
					<dt className="text-muted-foreground text-xs">
						{t(
							position.status === "on_hold"
								? "hiring.paused"
								: "hiring.inProcess",
						)}
					</dt>
					<dd className="font-medium font-numeric text-lg tabular-nums">
						{number.format(inProcess)}
					</dd>
				</div>
				<div className="grid">
					<dt className="text-muted-foreground text-xs">
						{t("hiring.applications")}
					</dt>
					<dd className="font-medium font-numeric text-lg tabular-nums">
						{number.format(position.applicationCount)}
					</dd>
				</div>
			</dl>
		</button>
	);
}
