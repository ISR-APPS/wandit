// The short roster under the title of the practitioners section: three more practitioners and their days.
// PractitionersSection renders it twice: in the title column from 900px, and under the cards below 900px.
// The names are the names of the fee register.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { LABEL } from "../lib/type-styles";

// The practitioners with no card. Each id is a row of the fee register and a key of `team.rosterDays`.
const ROSTER_IDS = ["dermatology", "ophthalmology", "physiotherapy"] as const;

/** A hairline list: the name and the specialty at the start, the consulting days at the end. The rule under it closes the list. */
export function RosterList({ className }: { className?: string }) {
	const { t } = useT();
	return (
		<div className={cn("mt-[clamp(26px,3vw,38px)]", className)}>
			<p className={cn(LABEL, "pb-3 text-muted-foreground tracking-[0.14em]")}>
				{t("team.rosterLabel")}
			</p>
			<ul className="border-border border-t">
				{ROSTER_IDS.map((id) => (
					<li
						key={id}
						className="flex items-baseline justify-between gap-4 border-border border-b py-3 last:border-b-0 last:pb-0"
					>
						<span>
							<span className="block font-display text-[1.0625rem] leading-[1.3] tracking-[-0.01em]">
								{t(`specialties.${id}.practitioner`)}
							</span>
							<span className="block text-[0.8125rem] text-muted-foreground">
								{t(`specialties.${id}.name`)}
							</span>
						</span>
						<span className="whitespace-nowrap text-[0.8125rem] tabular-nums">
							{t(`team.rosterDays.${id}`)}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}
