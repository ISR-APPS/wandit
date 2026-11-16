// The reserve panel of the booking band: pick a practice, see its classes this week, then hold a mat by email.
// BeginSection renders it. The choice is local UI state. The email button opens a mailto link with the practice
// in the subject. Nothing posts to a server: STARTER.md says where a real booking form goes.
import { useState } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	PRACTICE_NAME_KEYS,
	type PracticeId,
	sessionsOf,
	WEEK_DAYS,
} from "../lib/schedule";
import { GHOST_BUTTON, INK_BUTTON, LABEL } from "../lib/styles";

/** The practices in the order of the picker. */
const PICKER_ORDER: readonly PracticeId[] = [
	"slowFlow",
	"matPilates",
	"deepStretch",
	"breathwork",
	"openPractice",
];

/** The panel on the page bone. Slow Flow is picked first. */
export function ReservePanel() {
	const { t } = useT();
	const [practice, setPractice] = useState<PracticeId>("slowFlow");
	const practiceName = t(PRACTICE_NAME_KEYS[practice]);
	const sessions = sessionsOf(practice);
	const mailto = `mailto:${t("begin.emailDisplay")}?subject=${encodeURIComponent(`${t("begin.mailtoSubject")}${practiceName}`)}`;
	return (
		<div
			data-reveal
			className="rounded-2xl border border-(--sp-line-soft) bg-background p-[clamp(24px,3.4vw,46px)] shadow-surface"
		>
			<h3 className="font-display font-normal text-[1.6rem] leading-tight">
				{t("begin.panelTitle")}
			</h3>
			<p className="mt-1.5 text-(--sp-ink-78) text-[0.92rem]">
				{t("begin.panelBody")}
			</p>
			<fieldset className="mt-7">
				<legend className={LABEL}>{t("begin.pickerLabel")}</legend>
				<div className="mt-3 flex flex-wrap gap-2">
					{PICKER_ORDER.map((id) => {
						const isPicked = id === practice;
						return (
							<button
								key={id}
								type="button"
								aria-pressed={isPicked}
								onClick={() => setPractice(id)}
								className={cn(
									"inline-flex min-h-11 items-center rounded-full border px-4 font-display text-[1.02rem] transition-colors duration-500",
									isPicked
										? "border-primary bg-primary text-primary-foreground"
										: "border-(--sp-line) hover:border-foreground",
								)}
							>
								{t(PRACTICE_NAME_KEYS[id])}
							</button>
						);
					})}
				</div>
			</fieldset>
			<div className="mt-7 border-(--sp-line) border-t pt-5">
				<p className={cn(LABEL, "flex justify-between gap-4")}>
					<span>{t("begin.timesLabel")}</span>
					<span className="tabular-nums">
						{sessions.length} {t("begin.timesCount")}
					</span>
				</p>
				<ul
					aria-live="polite"
					className="mt-3 grid list-none grid-cols-2 gap-2 sm:grid-cols-3"
				>
					{sessions.map((session) => {
						const day = WEEK_DAYS[session.dayIndex];
						return (
							<li
								key={`${session.dayIndex}-${session.time}`}
								className="flex items-baseline justify-between gap-2 rounded-lg bg-(--sp-surface) px-3.5 py-2.5"
							>
								<span className="font-bold font-sans text-[0.72rem] uppercase tracking-[0.18em]">
									{day === undefined ? null : t(day.shortKey)}
								</span>
								<span className="font-display text-[1.05rem] tabular-nums">
									{session.time}
								</span>
							</li>
						);
					})}
				</ul>
			</div>
			<div className="mt-8 flex flex-wrap items-center gap-3">
				<a href={mailto} className={INK_BUTTON}>
					{t("begin.holdCta")}
				</a>
				<a href={t("begin.phoneHref")} className={GHOST_BUTTON}>
					{t("begin.callCta")}
				</a>
			</div>
			<p className="mt-5 max-w-[44ch] text-(--sp-ink-64) text-[0.82rem] leading-[1.5]">
				{t("begin.panelNote")}
			</p>
		</div>
	);
}
