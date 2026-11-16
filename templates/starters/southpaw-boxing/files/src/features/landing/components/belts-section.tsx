// Round 6, "Take a Title": the three memberships as title belts.
// landing-page.tsx renders it. It reads BELTS of lib/content.ts.
import { useT } from "~/shared/i18n";
import { BELTS } from "../lib/content";
import { BeltCard } from "./belt-card";
import { Reveal } from "./reveal";
import { RoundHeader } from "./round-header";

/** The prices are sample values. The cards do not take a payment: each action leads to the booking ticket. */
export function BeltsSection() {
	const { t } = useT();
	return (
		<section
			id="belts"
			aria-labelledby="belts-title"
			className="sp-gutter bg-linear-to-b from-canvas to-background py-14 md:py-20"
		>
			<div className="mx-auto max-w-7xl">
				<RoundHeader
					round={6}
					layout="center"
					titleId="belts-title"
					kickerStart={t("belts.kickerStart")}
					kickerEnd={t("belts.kickerEnd")}
					isGoldStar
					titleStart={t("belts.titleStart")}
					titleAccent={t("belts.titleAccent")}
					sub={t("belts.sub")}
				/>
				<div className="mx-auto grid max-w-lg gap-6 lg:max-w-none lg:grid-cols-3">
					{BELTS.map((belt, index) => (
						<Reveal key={belt.id} as="article" delayMs={index * 90}>
							<BeltCard belt={belt} />
						</Reveal>
					))}
				</div>
			</div>
		</section>
	);
}
