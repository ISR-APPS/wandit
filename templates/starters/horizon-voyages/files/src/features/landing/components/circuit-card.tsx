// One destination of the circuits grid: the locked photo, the name, three climate chips, a line of text,
// a hairline row with the duration and the price, and the link to the quote. CircuitsSection renders three of them.
// A "card" in this world is a photo, a hairline, and type on the ground: no box and no shadow.
import { useT } from "~/shared/i18n";
import type { Circuit } from "../lib/circuits";
import { BODY, CURRENCY, FIGURE, H3, META_SMALL } from "../lib/type-styles";
import { ClimateChips } from "./climate-chips";
import { LockedPhoto } from "./locked-photo";
import { TextLink } from "./text-link";

type CircuitCardProps = {
	circuit: Circuit;
};

/** The card. Its top margin comes from landing.css, so the three horizons meet one line. */
export function CircuitCard({ circuit }: CircuitCardProps) {
	const { t } = useT();
	return (
		<article
			id={`circuit-${circuit.id}`}
			data-reveal
			className="hz-card hz-rise scroll-mt-6"
			data-frame={circuit.frame}
		>
			<LockedPhoto
				photo={circuit.photo}
				lock={circuit.lock}
				alt={t(circuit.altKey)}
				className="hz-card-frame hz-wipe"
				rule="phone"
			/>
			<h3 className={`${H3} mt-[18px]`}>{t(circuit.nameKey)}</h3>
			<ClimateChips chipKeys={circuit.chipKeys} />
			<p className={`${BODY} mb-5`}>{t(circuit.bodyKey)}</p>
			<div className="mb-2 flex items-baseline justify-between gap-3.5 border-(--hz-hair) border-t pt-3">
				<span className={META_SMALL}>{t(circuit.durationKey)}</span>
				<span
					className={`${FIGURE} whitespace-nowrap text-[1.28rem] tabular-nums`}
				>
					{t(circuit.priceKey)}
					<span className={CURRENCY}>{t("circuits.currency")}</span>
				</span>
			</div>
			<TextLink href="#quote">{t("circuits.cta")}</TextLink>
		</article>
	);
}
