// The slot picker: a specialty, a day, and a grid of time chips. BookingSection renders it.
// It keeps the three choices in state and posts no data. Its action is a mailto link that holds the request.
// The days of each specialty and the slots come from lib/content.ts. STARTER.md says where a real booking form goes.
import { type ChangeEvent, useState } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	BOOKABLE_SPECIALTY_IDS,
	BOOKING_DAYS_BY_SPECIALTY,
	BOOKING_SLOTS,
	type BookingDayId,
	type Slot,
	type SpecialtyId,
} from "../lib/content";
import { BUTTON_FILLED, LABEL, PLATE, SECTION_TITLE } from "../lib/type-styles";

const FIELD_LABEL = cn(
	LABEL,
	"mb-2 block text-muted-foreground tracking-[0.14em]",
);
const FIELD =
	"sp-field h-11.5 w-full rounded-(--sp-chamfer) border border-border bg-background px-3 text-[0.9375rem] outline-none";

/** The first slot of a day that a visitor can still take, or null when the whole day is full. */
function firstFreeTime(slots: readonly Slot[]): string | null {
	return slots.find((slot) => !slot.isFull)?.time ?? null;
}

/**
 * A flat plate with the teal corner tick. A full slot shows struck through and cannot be picked.
 * The day list shows only the consulting days of the specialty. A change of day keeps a time that is still free.
 */
export function SlotPicker() {
	const { t } = useT();
	const [specialtyId, setSpecialtyId] = useState<SpecialtyId>("general");
	const [dayId, setDayId] = useState<BookingDayId>("sunday");
	const [pickedTime, setPickedTime] = useState(() =>
		firstFreeTime(BOOKING_SLOTS.sunday),
	);
	const slots = BOOKING_SLOTS[dayId];
	const dayIds = BOOKING_DAYS_BY_SPECIALTY[specialtyId];

	const pickDay = (next: BookingDayId) => {
		const nextSlots = BOOKING_SLOTS[next];
		const isStillFree = nextSlots.some(
			(slot) => slot.time === pickedTime && !slot.isFull,
		);
		setDayId(next);
		if (!isStillFree) {
			setPickedTime(firstFreeTime(nextSlots));
		}
	};
	const changeSpecialty = (event: ChangeEvent<HTMLSelectElement>) => {
		const next = BOOKABLE_SPECIALTY_IDS.find((id) => id === event.target.value);
		if (next === undefined) {
			return;
		}
		setSpecialtyId(next);
		// A specialty consults on fixed days. The picker never keeps a day on which its doctor is absent.
		const nextDayIds = BOOKING_DAYS_BY_SPECIALTY[next];
		const firstDayId = nextDayIds[0];
		if (!nextDayIds.includes(dayId) && firstDayId !== undefined) {
			pickDay(firstDayId);
		}
	};
	const changeDay = (event: ChangeEvent<HTMLSelectElement>) => {
		const next = dayIds.find((id) => id === event.target.value);
		if (next !== undefined) {
			pickDay(next);
		}
	};

	const specialtyName = t(`specialties.${specialtyId}.name`);
	const dayName = t(`booking.days.${dayId}.name`);
	// A day with no free slot has no request: the plate then asks the visitor to pick another day or to call.
	const requestTime =
		pickedTime === null
			? null
			: `${dayName} ${t("booking.requestAt")} ${pickedTime}`;
	// The email holds the request and three lines that the visitor completes.
	const mailHref =
		requestTime === null
			? null
			: `mailto:${t("site.email")}?subject=${encodeURIComponent(
					`${t("booking.mailSubject")} — ${specialtyName}`,
				)}&body=${encodeURIComponent(
					[
						t("booking.mailGreeting"),
						"",
						t("booking.mailRequest"),
						`${specialtyName} — ${requestTime}`,
						"",
						t("booking.mailName"),
						t("booking.mailPhone"),
						t("booking.mailReason"),
					].join("\n"),
				)}`;

	return (
		<div className={cn(PLATE, "sp-tick p-[clamp(22px,3vw,40px)]")}>
			<h2
				id="booking-title"
				className={cn(
					SECTION_TITLE,
					"mb-2.5 text-[clamp(1.6rem,2.4vw,2.15rem)]",
				)}
			>
				{t("booking.title")}
			</h2>
			<p className="mb-[clamp(24px,2.6vw,32px)] max-w-[52ch] text-[0.9375rem] text-muted-foreground leading-[1.7]">
				{t("booking.lede")}
			</p>
			<div className="grid gap-4.5 sm:grid-cols-2 sm:gap-4">
				<label className="block">
					<span className={FIELD_LABEL}>{t("booking.specialtyLabel")}</span>
					<select
						value={specialtyId}
						onChange={changeSpecialty}
						className={FIELD}
					>
						{BOOKABLE_SPECIALTY_IDS.map((id) => (
							<option key={id} value={id}>
								{t(`specialties.${id}.name`)} — {t(`specialties.${id}.fee`)}
							</option>
						))}
					</select>
				</label>
				<label className="block">
					<span className={FIELD_LABEL}>{t("booking.dayLabel")}</span>
					<select value={dayId} onChange={changeDay} className={FIELD}>
						{dayIds.map((id) => (
							<option key={id} value={id}>
								{t(`booking.days.${id}.option`)}
							</option>
						))}
					</select>
				</label>
			</div>
			<fieldset className="mt-5.5">
				<legend className="sr-only">{t("booking.slotsLabel")}</legend>
				<div className="mb-3 flex items-baseline justify-between gap-3">
					<span
						aria-hidden="true"
						className={cn(LABEL, "text-muted-foreground tracking-[0.14em]")}
					>
						{t("booking.slotsLabel")}
					</span>
					<span className="text-muted-foreground text-xs">
						{t("booking.slotsLegend")}
					</span>
				</div>
				<div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-2 md:grid-cols-[repeat(auto-fill,minmax(84px,1fr))]">
					{slots.map((slot) => (
						<label key={slot.time} className="sp-chip relative block">
							<input
								type="radio"
								name="slot"
								value={slot.time}
								checked={slot.time === pickedTime}
								disabled={slot.isFull}
								onChange={() => setPickedTime(slot.time)}
								className="sr-only"
							/>
							<span className="sp-chip-face flex h-11 cursor-pointer items-center justify-center rounded-(--sp-chamfer) border border-border bg-background font-medium text-sm tabular-nums">
								{slot.time}
							</span>
							{slot.isFull ? (
								<span className="sr-only">{t("booking.slotFull")}</span>
							) : null}
						</label>
					))}
				</div>
			</fieldset>
			<div aria-live="polite" className="mt-6.5 border-border border-t pt-5">
				<p className={cn(LABEL, "text-muted-foreground tracking-[0.14em]")}>
					{t("booking.requestLabel")}
				</p>
				{requestTime === null ? (
					<p className="mt-3 text-[0.9375rem] leading-[1.6]">
						{t("booking.dayFull")}
					</p>
				) : (
					<p className="mt-3 font-display text-[clamp(1.2rem,1.7vw,1.45rem)] leading-[1.3] tracking-[-0.012em]">
						{specialtyName} —{" "}
						<span className="whitespace-nowrap">{requestTime}</span>
					</p>
				)}
				<p className="mt-1.5 text-muted-foreground text-sm tabular-nums">
					{t(`specialties.${specialtyId}.practitioner`)} ·{" "}
					{t(`specialties.${specialtyId}.duration`)} ·{" "}
					{t(`specialties.${specialtyId}.fee`)}
				</p>
			</div>
			<div className="mt-5.5 flex flex-wrap items-center gap-x-4.5 gap-y-2">
				{mailHref === null ? null : (
					<a href={mailHref} className={BUTTON_FILLED}>
						{t("booking.send")}
					</a>
				)}
				<p className="text-muted-foreground text-sm">
					{mailHref === null ? null : `${t("booking.orCall")} `}
					<a
						href={t("site.phoneHref")}
						className="inline-flex min-h-11 items-center text-(--sp-teal-deep) tabular-nums underline decoration-primary/40 underline-offset-4 transition-colors duration-200 hover:decoration-primary"
					>
						{t("site.phoneDisplay")}
					</a>
				</p>
			</div>
			<p className="mt-3 max-w-[56ch] text-balance text-muted-foreground text-xs leading-normal">
				{t("booking.honestNote")}
			</p>
		</div>
	);
}
