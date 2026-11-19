// One appointment as a small chip of the calendar: the start time and the patient name on the department color.
// The month grid and the week grid render it. A click opens the detail panel of the appointment.
import { type AppointmentRow, SPECIALTY_TONE } from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

type EventChipProps = {
	row: AppointmentRow;
	/** Opens the detail panel. The page puts the id in the URL. */
	onOpen: (appointmentId: string) => void;
};

/** A visit that did not happen (a no-show, a cancellation) is struck through, so the day shows what really took place. */
export function EventChip({ row, onOpen }: EventChipProps) {
	const { t, locale } = useT();
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const didNotHappen = row.status === "no_show" || row.status === "cancelled";
	return (
		<button
			type="button"
			onClick={() => onOpen(row.id)}
			title={`${time.format(row.startsAt)} ${row.patient.fullName} · ${t(`visitTypes.${row.visitType}`)}`}
			className={cn(
				"flex w-full min-w-0 items-baseline gap-1 rounded-sm px-1.5 py-0.5 text-start text-xs outline-none hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50",
				SPECIALTY_TONE[row.practitioner.specialty].soft,
				didNotHappen && "text-muted-foreground line-through",
			)}
		>
			<span className="shrink-0 text-muted-foreground tabular-nums">
				{time.format(row.startsAt)}
			</span>
			<span className="truncate font-medium" dir="auto">
				{row.patient.fullName}
			</span>
		</button>
	);
}
