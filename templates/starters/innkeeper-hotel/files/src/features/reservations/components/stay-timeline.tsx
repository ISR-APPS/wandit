// The timeline of one reservation: a dot and a line per step, from the booking to the departure.
// ReservationDetailPage renders it in the Timeline tab. A step in the future has an empty dot and muted text.
import { moneyFormat } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { stepLabel, type TimelineStep } from "../lib/stay-timeline";

type StayTimelineProps = {
	/** The steps of the reservation, oldest first. */
	steps: TimelineStep[];
};

/** An ordered list. Each step shows its label, its amount when it is a payment, and its date and time. */
export function StayTimeline({ steps }: StayTimelineProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const dateTime = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		hour: "numeric",
		minute: "2-digit",
	});

	return (
		<ol className="grid">
			{steps.map((step, index) => (
				<li key={step.id} className="relative grid gap-0.5 ps-6 pb-5 last:pb-0">
					{/* The line joins this dot to the next one. The last step has no line. */}
					{index < steps.length - 1 ? (
						<span
							aria-hidden="true"
							className="absolute start-[4px] top-3 bottom-0 w-px bg-border"
						/>
					) : null}
					<span
						aria-hidden="true"
						className={cn(
							"absolute start-0 top-1.5 size-[9px] rounded-full border",
							step.isDone
								? "border-primary bg-primary"
								: "border-input bg-background",
						)}
					/>
					<span
						className={cn(
							"text-sm",
							step.isDone ? "font-medium" : "text-muted-foreground",
						)}
					>
						{stepLabel(step, t, money)}
					</span>
					<span className="text-muted-foreground text-xs tabular-nums">
						{dateTime.format(new Date(step.at))}
					</span>
				</li>
			))}
		</ol>
	);
}
