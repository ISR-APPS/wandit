// The card of one practitioner: the specialty, the name, and four facts that a patient can check.
// PractitionersSection renders four of them. The texts come from the group `team.<id>`.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { PractitionerId } from "../lib/content";
import { LABEL, PLATE } from "../lib/type-styles";

// The four facts of a card: the key of the label and the field of the practitioner group.
const FACT_ROWS = [
	{ label: "team.councilLabel", field: "council" },
	{ label: "team.degreeLabel", field: "degree" },
	{ label: "team.daysLabel", field: "days" },
	{ label: "team.languagesLabel", field: "languages" },
] as const;

/** A flat plate with the teal corner tick. The tick grows on hover and on keyboard focus. */
export function PractitionerCard({ id }: { id: PractitionerId }) {
	const { t } = useT();
	return (
		<article
			data-reveal="rise"
			className={cn(PLATE, "sp-tick sp-card p-[clamp(20px,2.2vw,28px)]")}
		>
			<p
				className={cn(LABEL, "mb-3.5 text-(--sp-teal-deep) tracking-[0.14em]")}
			>
				{t(`team.${id}.specialty`)}
			</p>
			<h3 className="font-display text-[clamp(1.2rem,1.5vw,1.4rem)] leading-tight tracking-[-0.01em]">
				{t(`team.${id}.name`)}
			</h3>
			<dl className="mt-4.5 grid gap-2 border-border/70 border-t pt-3.5">
				{FACT_ROWS.map((row) => (
					<div
						key={row.field}
						className="flex justify-between gap-3.5 text-[0.8125rem]"
					>
						<dt className="text-muted-foreground">{t(row.label)}</dt>
						<dd className="text-end tabular-nums">
							{t(`team.${id}.${row.field}`)}
						</dd>
					</div>
				))}
			</dl>
		</article>
	);
}
