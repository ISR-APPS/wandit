// Section 02, the districts: the drawn map with its pins and the district sheet.
// LandingPage renders it and passes the setter of the register filter, for the "see its homes" button.
// It renders DistrictMap and DistrictSheet, and reads lib/districts.ts.
import { useState } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useReveal } from "../hooks/use-reveal";
import { DISTRICTS, type DistrictId } from "../lib/districts";
import { WRAP } from "../lib/type-styles";
import { DistrictMap } from "./district-map";
import { DistrictSheet } from "./district-sheet";
import { SectionHead } from "./section-head";

type DistrictsSectionProps = {
	/** Sets the register filter to one district. */
	onShowHomes: (id: DistrictId) => void;
};

/** A second press on the pressed pin closes the sheet and zooms the map out. */
export function DistrictsSection({ onShowHomes }: DistrictsSectionProps) {
	const { t } = useT();
	const [selectedId, setSelectedId] = useState<DistrictId | null>(null);
	const revealRef = useReveal<HTMLDivElement>();
	const selected = DISTRICTS.find((district) => district.id === selectedId);

	function showHomes(id: DistrictId) {
		onShowHomes(id);
		const reduced = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		document
			.getElementById("register")
			?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
	}

	return (
		<section
			id="districts"
			aria-labelledby="districts-title"
			className={cn(WRAP, "pb-[clamp(56px,8vw,110px)]")}
		>
			<SectionHead
				tag={t("districts.tag")}
				title={t("districts.title")}
				note={t("districts.note")}
				titleId="districts-title"
			/>
			<div
				ref={revealRef}
				className="rn-rise grid items-start gap-[clamp(24px,3vw,48px)] lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)] lg:items-stretch"
			>
				<DistrictMap
					selectedId={selectedId}
					onPinPress={(id) =>
						setSelectedId((current) => (current === id ? null : id))
					}
				/>
				<DistrictSheet district={selected} onShowHomes={showHomes} />
			</div>
		</section>
	);
}
