// One SLA clock of a ticket: its name, its target, and its state (met or missed, running with a bar, or paused).
// SlaCard renders two of them: the first reply and the resolution.
import { fillMessage, formatDuration } from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Progress } from "~/shared/ui/progress";

/** The state of one clock: stopped with a result, running toward the target, or paused. Minutes since the creation. */
export type ClockState =
	| { kind: "done"; tookMinutes: number }
	| { kind: "running"; elapsedMinutes: number }
	| { kind: "paused" };

type SlaClockProps = {
	label: string;
	/** The target of the priority, in minutes. */
	targetMinutes: number;
	state: ClockState;
};

/** One clock row. A running clock past its target turns the bar and the time red. */
export function SlaClock({ label, targetMinutes, state }: SlaClockProps) {
	const { t, locale } = useT();
	const target = fillMessage(t("tickets.target"), {
		time: formatDuration(targetMinutes, locale),
	});
	if (state.kind === "paused") {
		return (
			<div className="grid gap-1.5 text-sm">
				<div className="flex items-center justify-between gap-3">
					<span className="font-medium">{label}</span>
					<Badge variant="secondary">{t("tickets.paused")}</Badge>
				</div>
				<p className="text-muted-foreground text-xs">
					{t("tickets.pausedHint")}
				</p>
			</div>
		);
	}
	if (state.kind === "done") {
		const isMet = state.tookMinutes <= targetMinutes;
		return (
			<div className="grid gap-1.5 text-sm">
				<div className="flex items-center justify-between gap-3">
					<span className="font-medium">{label}</span>
					<Badge variant={isMet ? "success" : "destructive"}>
						{t(isMet ? "tickets.met" : "tickets.missed")}
					</Badge>
				</div>
				<p className="text-muted-foreground text-xs">
					{fillMessage(t("tickets.took"), {
						time: formatDuration(state.tookMinutes, locale),
					})}
					{` · ${target}`}
				</p>
			</div>
		);
	}
	const leftMinutes = targetMinutes - state.elapsedMinutes;
	const isLate = leftMinutes < 0;
	return (
		<div className="grid gap-2 text-sm">
			<div className="flex items-center justify-between gap-3">
				<span className="font-medium">{label}</span>
				<span
					className={cn(
						"tabular-nums",
						isLate ? "font-medium text-destructive" : "text-muted-foreground",
					)}
				>
					{fillMessage(t(isLate ? "tickets.lateBy" : "tickets.timeLeft"), {
						time: formatDuration(Math.abs(leftMinutes), locale),
					})}
				</span>
			</div>
			<Progress
				value={state.elapsedMinutes}
				max={targetMinutes}
				aria-label={label}
				className={cn(
					isLate &&
						"bg-destructive/20 [&>[data-slot=progress-indicator]]:bg-destructive",
				)}
			/>
			<p className="text-muted-foreground text-xs">{target}</p>
		</div>
	);
}
