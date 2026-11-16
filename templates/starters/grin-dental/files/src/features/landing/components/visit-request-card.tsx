// The visit request card: two rows of chips (age, best time), a ticket line, and an email button.
// BookSection renders it. It sends nothing: the button opens the email app of the visitor with a filled-in
// request to the studio address. The chips only change the ticket and the email text.
import { useState } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { AGE_CHOICES, type RequestChoice, TIME_CHOICES } from "../lib/content";
import { BUTTON_BIG, DISPLAY } from "../lib/styles";

/** The label key of the chosen value, or of the first choice when the value is unknown. */
function labelKeyOf(choices: readonly RequestChoice[], value: string) {
	return (choices.find((choice) => choice.value === value) ?? choices[0])
		?.labelKey;
}

/**
 * A white sticker tilted 0.8 degrees, with a die-cut ring. Straight under 1024px.
 * Under 640px a side margin keeps the ring and the 7px shadow inside the 16px page gutter.
 */
export function VisitRequestCard() {
	const { t } = useT();
	const [age, setAge] = useState(AGE_CHOICES[1]?.value ?? "");
	const [time, setTime] = useState(TIME_CHOICES[0]?.value ?? "");
	const ageKey = labelKeyOf(AGE_CHOICES, age);
	const timeKey = labelKeyOf(TIME_CHOICES, time);
	const ageLabel = ageKey === undefined ? "" : t(ageKey);
	const timeLabel = timeKey === undefined ? "" : t(timeKey);

	// The email text that the visitor sees in the email app before sending it.
	const mailBody = [
		t("book.mailGreeting"),
		"",
		`${t("book.mailAge")}: ${ageLabel}`,
		`${t("book.mailTime")}: ${timeLabel}`,
		"",
		t("book.mailClosing"),
	].join("\n");
	const mailHref = `${t("site.emailHref")}?subject=${encodeURIComponent(
		`${t("book.mailSubject")} · ${ageLabel} · ${timeLabel}`,
	)}&body=${encodeURIComponent(mailBody)}`;

	return (
		<div
			data-pop="self"
			className="gd-sticker gd-diecut relative px-[clamp(1.3rem,3vw,2.2rem)] pt-[clamp(1.6rem,3vw,2.2rem)] pb-[clamp(1.5rem,3vw,2rem)] max-sm:mx-1.5 lg:rotate-[0.8deg]"
		>
			<h3 className={cn(DISPLAY, "mb-1.5 text-[1.6rem] leading-tight")}>
				{t("book.cardTitle")}
			</h3>
			<p className="mb-6 font-bold text-[0.95rem] text-foreground/72">
				{t("book.cardSub")}
			</p>
			<fieldset className="mb-5">
				<legend className="mb-2.5 font-bold font-display text-[0.92rem]">
					{t("book.ageLegend")}
				</legend>
				<div className="flex flex-wrap gap-2.5">
					{AGE_CHOICES.map((choice) => (
						<label
							key={choice.value}
							className="gd-chip relative inline-flex cursor-pointer"
						>
							<input
								type="radio"
								name="gd-age"
								value={choice.value}
								checked={age === choice.value}
								onChange={() => setAge(choice.value)}
								className="absolute inset-0 cursor-pointer opacity-0"
							/>
							<span className="gd-chip-face gd-outline-thin inline-flex min-h-11 items-center rounded-full px-4 font-bold font-display text-[0.9rem]">
								{t(choice.labelKey)}
							</span>
						</label>
					))}
				</div>
			</fieldset>
			<fieldset className="mb-6">
				<legend className="mb-2.5 font-bold font-display text-[0.92rem]">
					{t("book.timeLegend")}
				</legend>
				<div className="flex flex-wrap gap-2.5">
					{TIME_CHOICES.map((choice) => (
						<label
							key={choice.value}
							className="gd-chip relative inline-flex cursor-pointer"
						>
							<input
								type="radio"
								name="gd-time"
								value={choice.value}
								checked={time === choice.value}
								onChange={() => setTime(choice.value)}
								className="absolute inset-0 cursor-pointer opacity-0"
							/>
							<span className="gd-chip-face gd-outline-thin inline-flex min-h-11 items-center rounded-full px-4 font-bold font-display text-[0.9rem]">
								{t(choice.labelKey)}
							</span>
						</label>
					))}
				</div>
			</fieldset>
			<p
				aria-live="polite"
				className="mb-6 rounded-[calc(var(--radius)*0.875)] border-2 border-foreground/28 border-dashed bg-(--gd-mint) px-4 py-3 font-bold text-[0.95rem] leading-snug"
			>
				<span className="me-2 font-display font-extrabold text-(--gd-teal) text-[0.78rem] uppercase tracking-[0.1em]">
					{t("book.ticketLabel")}
				</span>
				{t("book.ticketVisit")} · {ageLabel} · {timeLabel}
			</p>
			<div className="flex flex-wrap items-center gap-x-5 gap-y-3">
				<a href={mailHref} className={BUTTON_BIG}>
					{t("book.send")}
					<span aria-hidden="true" className="inline-block rtl:-scale-x-100">
						→
					</span>
				</a>
				<a
					href={t("site.phoneHref")}
					className="inline-flex min-h-11 items-center font-bold font-display text-[0.95rem] underline decoration-2 decoration-primary underline-offset-4 hover:text-primary"
				>
					{t("book.call")} {t("site.phoneDisplay")}
				</a>
			</div>
			<p className="mt-4 max-w-[46ch] font-bold text-[0.82rem] text-foreground/72">
				{t("book.note")}
			</p>
		</div>
	);
}
