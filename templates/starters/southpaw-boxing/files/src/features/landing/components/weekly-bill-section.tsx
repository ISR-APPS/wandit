// Round 4, "The Weekly Bill": the class schedule as six day cards, the closed Sunday strip, and the tag legend.
// landing-page.tsx renders it. It reads BILL_DAYS and CLASS_TAGS of lib/content.ts.
import { useT } from "~/shared/i18n";
import { BILL_DAYS, CLASS_TAGS } from "../lib/content";
import { ClassTagChip } from "./class-tag-chip";
import { DayCard } from "./day-card";
import { Reveal } from "./reveal";
import { RoundHeader } from "./round-header";
import { Star } from "./star";

/** The schedule is fixed sample content. STARTER.md says how to move it to a table. */
export function WeeklyBillSection() {
	const { t } = useT();
	return (
		<section
			id="schedule"
			aria-labelledby="schedule-title"
			className="sp-gutter bg-linear-to-b from-canvas to-background py-14 md:py-20"
		>
			<div className="mx-auto max-w-7xl">
				<RoundHeader
					round={4}
					layout="start"
					titleId="schedule-title"
					kickerStart={t("bill.kickerStart")}
					kickerEnd={t("bill.kickerEnd")}
					titleStart={t("bill.titleStart")}
					titleAccent={t("bill.titleAccent")}
					sub={t("bill.sub")}
				/>
				<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{BILL_DAYS.map((day, index) => (
						<Reveal key={day.id} as="article" delayMs={(index % 3) * 90}>
							<DayCard day={day} />
						</Reveal>
					))}
					<Reveal className="sp-line-strong col-span-full flex min-h-22 items-center justify-center border border-dashed p-4">
						<p className="sp-faint text-center font-display font-extrabold text-2xl uppercase leading-tight tracking-[0.14em]">
							{t("bill.closedStart")}
							<Star className="mx-3 text-[0.7em] text-primary" />
							{t("bill.closedEnd")}
						</p>
					</Reveal>
				</div>
				<Reveal>
					<ul className="sp-faint mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-[0.66rem] uppercase tracking-[0.2em]">
						{CLASS_TAGS.map((entry) => (
							<li key={entry.tag} className="flex items-center gap-2.5">
								<ClassTagChip tag={entry.tag} />
								{t(entry.legend)}
							</li>
						))}
					</ul>
				</Reveal>
			</div>
		</section>
	);
}
