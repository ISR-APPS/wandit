// The list of what a patient brings on the day of the visit. BookingSection renders it under the slot picker.
// Each bullet is a short teal dash, drawn in landing.css.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { LABEL, PLATE } from "../lib/type-styles";

const BRING_KEYS = [
	"booking.bringCard",
	"booking.bringPrescriptions",
	"booking.bringResults",
	"booking.bringChild",
] as const;

/** A flat plate with four items, in two columns from 640px. `className` places it in the column of the section. */
export function BringList({ className }: { className?: string }) {
	const { t } = useT();
	return (
		<div className={cn(PLATE, "p-[clamp(20px,2.4vw,30px)]", className)}>
			<p className={cn(LABEL, "text-muted-foreground tracking-[0.14em]")}>
				{t("booking.bringLabel")}
			</p>
			<ul className="sp-dash-list mt-4 grid gap-x-8 gap-y-2.5 text-muted-foreground text-sm leading-normal sm:grid-cols-2">
				{BRING_KEYS.map((key) => (
					<li key={key}>{t(key)}</li>
				))}
			</ul>
		</div>
	);
}
