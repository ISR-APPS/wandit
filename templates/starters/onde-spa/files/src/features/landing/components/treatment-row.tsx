// One row of the treatment list: a pebble marker, the name as a link to the booking, a sentence, a duration, a price.
// TreatmentsSection renders five of them. landing.css lifts the pebble when the row has hover or focus.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { BODY_TEXT, ITEM_TITLE, META } from "../lib/styles";
import { PebbleGlyph } from "./pebble-glyph";

type TreatmentRowProps = {
	/** Translated treatment name. It links to the booking section, so keyboard focus can reach the row. */
	name: string;
	/** Translated sentence about what the treatment holds. */
	body: string;
	/** Translated duration, for example "60 minutes". */
	duration: string;
	/** Translated price in dinars, digits only, for example "3 500". The row adds the "DA" affix. */
	price: string;
};

/** An <li> on a 16% hairline. On a phone the price drops under the text. */
export function TreatmentRow({
	name,
	body,
	duration,
	price,
}: TreatmentRowProps) {
	const { t } = useT();
	return (
		<li
			data-reveal=""
			className="onde-row grid grid-cols-[20px_minmax(0,1fr)] items-baseline gap-x-[clamp(0.9rem,1.8vw,1.8rem)] gap-y-2.5 border-(--onde-hair) border-b py-[clamp(1.35rem,2.8vh,2rem)] sm:grid-cols-[24px_minmax(0,1fr)_auto]"
		>
			<PebbleGlyph className="onde-row-pebble mt-[0.35rem] self-start text-(--onde-sage)" />
			<div>
				<h3 className={ITEM_TITLE}>
					{/* The ::after box adds 10px over and under the 24px line, so a finger gets a 44px target. */}
					<a
						href="#book"
						className="relative border-transparent border-b no-underline transition-colors duration-[350ms] ease-(--onde-tide) after:absolute after:inset-x-0 after:-inset-y-2.5 hover:border-(--onde-sage) focus-visible:border-(--onde-sage)"
					>
						{name}
					</a>
				</h3>
				<p
					className={cn(
						BODY_TEXT,
						"mt-[0.35rem] max-w-[48ch] text-[0.93rem] leading-[1.65]",
					)}
				>
					{body}
				</p>
				<span className={cn(META, "mt-2 block")}>{duration}</span>
			</div>
			<p className="col-start-2 whitespace-nowrap font-display text-[clamp(1.15rem,1.5vw,1.45rem)] tabular-nums sm:col-start-3">
				{price}
				<span className="ms-1.5 font-sans text-(--onde-ink-66) text-[0.68rem] tracking-[0.14em]">
					{t("treatments.currency")}
				</span>
			</p>
		</li>
	);
}
