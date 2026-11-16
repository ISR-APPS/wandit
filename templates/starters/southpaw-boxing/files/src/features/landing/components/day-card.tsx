// One day of the weekly bill: the day name, the door time, and four classes with their program tags.
// weekly-bill-section.tsx renders one for each entry of BILL_DAYS.
import { useT } from "~/shared/i18n";
import type { BillDay } from "../lib/content";
import { ClassTagChip } from "./class-tag-chip";

/** A day card. The class times use a 24-hour clock. */
export function DayCard({ day }: { day: BillDay }) {
	const { t } = useT();
	return (
		<div className="sp-surface sp-line-strong h-full border">
			<div className="sp-line-strong flex items-baseline justify-between border-b-2 bg-canvas px-5 pt-3.5 pb-3">
				<h3 className="font-display font-extrabold text-3xl uppercase leading-none tracking-[0.05em]">
					{t(`bill.${day.id}.name`)}
				</h3>
				<span className="sp-faint font-bold text-[0.62rem] uppercase tracking-[0.24em]">
					{day.opensLate ? t("bill.doorsLate") : t("bill.doorsEarly")}
				</span>
			</div>
			<ul>
				{day.slots.map((slot) => (
					<li
						key={slot.index}
						className="sp-slot flex items-center gap-3.5 px-5 py-3 text-[0.9rem]"
					>
						<span className="sp-slot-time min-w-13 font-display font-extrabold text-xl tabular-nums leading-none tracking-[0.02em]">
							{slot.time}
						</span>
						<span className="sp-slot-name flex-1 text-muted-foreground leading-snug">
							{t(`bill.${day.id}.slot${slot.index}`)}
						</span>
						<ClassTagChip tag={slot.tag} />
					</li>
				))}
			</ul>
		</div>
	);
}
