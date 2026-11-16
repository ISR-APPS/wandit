// Section 01, "the three departures": three circuits at three frame heights whose horizons meet one sun line.
// LandingPage renders it on the paper ground. The data is in lib/circuits.ts.
// From 900px one rule crosses the whole grid. On a phone the cards stack and each photo draws its own rule at 34%.
import { useT } from "~/shared/i18n";
import { CIRCUITS } from "../lib/circuits";
import { SECTION, WRAP } from "../lib/type-styles";
import { CircuitCard } from "./circuit-card";
import { SectionHead } from "./section-head";

/** The circuits grid with its section head. The top third of the section is open ground. */
export function CircuitsSection() {
	const { t } = useT();
	return (
		<section
			id="circuits"
			aria-labelledby="circuits-title"
			className={`${SECTION} scroll-mt-4 bg-background pt-[clamp(6.5rem,14vh,10rem)]`}
		>
			<div className={WRAP}>
				<SectionHead
					label={t("circuits.label")}
					title={t("circuits.title")}
					titleId="circuits-title"
					note={t("circuits.note")}
				/>
				<div className="hz-circuits">
					<div aria-hidden="true" className="hz-circuits-line" />
					<div className="hz-circuits-grid">
						{CIRCUITS.map((circuit) => (
							<CircuitCard key={circuit.id} circuit={circuit} />
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
