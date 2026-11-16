// Movement 02, "Practices": the matrix. LandingPage renders it on the pale steel ground.
// Four full-width ledger rows replace the cards of other sites: numeral, title and prose, and a meta column.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { PRACTICES } from "../lib/content";
import { MOVEMENT, SECTION_TITLE } from "../lib/type-styles";
import { PracticeRow } from "./practice-row";
import { SectionLabel } from "./section-label";

/** The four practices of the firm as one table. The rule above the first row draws from the start edge. */
export function PracticesSection() {
	const { t } = useT();
	return (
		<section id="practices" data-movement className={cn(MOVEMENT, "cap-steel")}>
			<div className="cap-wrap">
				<SectionLabel data-reveal className="mb-[1.4rem]">
					{t("practices.label")}
				</SectionLabel>
				<h2 data-reveal className={cn(SECTION_TITLE, "max-w-[62ch]")}>
					{t("practices.title")}
				</h2>
				<div
					data-reveal="rule"
					className="mt-[clamp(2rem,4vh,3rem)] h-px bg-foreground/18"
				/>
				<div data-reveal-group>
					{PRACTICES.map((practice, index) => (
						<PracticeRow
							key={practice.id}
							practice={practice}
							numeral={String(index + 1).padStart(2, "0")}
						/>
					))}
				</div>
			</div>
		</section>
	);
}
