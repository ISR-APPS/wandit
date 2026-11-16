// One row of the fee register: a specialty, who gives it, how long it takes, and its fee.
// SpecialtiesSection renders nine of them. The texts come from the group `specialties.<id>`.
// On a phone the practitioner and the fee move to a second line under the name.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { SpecialtyId } from "../lib/content";

/** The three columns of the register from 768px: the name, the practitioner, then the duration and the fee. */
export const REGISTER_COLUMNS =
	"md:grid-cols-[minmax(0,1fr)_minmax(0,0.42fr)_minmax(190px,0.36fr)] md:gap-x-[clamp(12px,1.8vw,26px)]";

/** A row is evidence: it always shows a duration and a fee. A hover fills it and draws a teal dash in the margin. */
export function SpecialtyRow({ id }: { id: SpecialtyId }) {
	const { t } = useT();
	return (
		<li
			data-reveal="rise"
			className={cn(
				"sp-row relative grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3.5 gap-y-1 border-border border-b pt-5 pb-4.5",
				REGISTER_COLUMNS,
			)}
		>
			<div className="col-span-2 md:col-span-1">
				<h3 className="font-display text-[clamp(1.15rem,1.55vw,1.45rem)] leading-[1.2] tracking-[-0.015em]">
					{t(`specialties.${id}.name`)}
				</h3>
				<p className="mt-1.5 max-w-[60ch] text-pretty text-[0.9375rem] text-muted-foreground leading-normal">
					{t(`specialties.${id}.description`)}
				</p>
			</div>
			<p className="mt-3 text-[0.8125rem] text-muted-foreground md:mt-0 md:text-sm">
				{t(`specialties.${id}.practitioner`)}
			</p>
			<p className="mt-3 flex items-baseline justify-end gap-3 md:mt-0 md:gap-[clamp(14px,1.6vw,26px)]">
				<span className="text-[0.8125rem] text-muted-foreground tabular-nums md:text-sm">
					{t(`specialties.${id}.duration`)}
				</span>
				<span className="whitespace-nowrap text-end font-display text-[1.05rem] tabular-nums md:min-w-24.5 md:text-lg">
					{t(`specialties.${id}.fee`)}
				</span>
			</p>
			<span
				aria-hidden="true"
				className="sp-row-mark absolute -start-5.5 top-7 h-0.5 w-2.5 bg-primary"
			/>
		</li>
	);
}
