// The programmes section: a head row, then four programme blocks with their yearly price in DZD.
// LandingPage renders it after the date strip. The copy lives in the `programmes` message group.
import { useT } from "~/shared/i18n";
import { BAND, LEDE, WRAP } from "../lib/type-styles";
import { ProgrammeCard } from "./programme-card";
import { SectionHead } from "./section-head";

/** Four columns from 1080px, two from 580px, one on a phone. */
export function ProgrammesSection() {
	const { t } = useT();
	const period = t("programmes.period");
	const programmes = [
		{
			tone: "sky" as const,
			name: t("programmes.computingName"),
			length: t("programmes.computingLength"),
			seats: t("programmes.computingSeats"),
			body: t("programmes.computingBody"),
			price: t("programmes.computingPrice"),
			linkLabel: t("programmes.computingLink"),
		},
		{
			tone: "pale" as const,
			name: t("programmes.managementName"),
			length: t("programmes.managementLength"),
			seats: t("programmes.managementSeats"),
			body: t("programmes.managementBody"),
			price: t("programmes.managementPrice"),
			linkLabel: t("programmes.managementLink"),
		},
		{
			tone: "sand" as const,
			name: t("programmes.designName"),
			length: t("programmes.designLength"),
			seats: t("programmes.designSeats"),
			body: t("programmes.designBody"),
			price: t("programmes.designPrice"),
			linkLabel: t("programmes.designLink"),
		},
		{
			tone: "line" as const,
			name: t("programmes.languagesName"),
			length: t("programmes.languagesLength"),
			seats: t("programmes.languagesSeats"),
			body: t("programmes.languagesBody"),
			price: t("programmes.languagesPrice"),
			linkLabel: t("programmes.languagesLink"),
		},
	];
	return (
		<section
			id="programmes"
			aria-labelledby="programmes-title"
			className={BAND}
		>
			<div className={WRAP}>
				<SectionHead
					headingId="programmes-title"
					eyebrow={t("programmes.eyebrow")}
					title={t("programmes.title")}
					aside={<p className={LEDE}>{t("programmes.lede")}</p>}
				/>
				<div
					data-stagger=""
					className="grid grid-cols-1 gap-3.5 min-[1080px]:grid-cols-4 min-[580px]:grid-cols-2"
				>
					{programmes.map((programme) => (
						<ProgrammeCard
							key={programme.name}
							period={period}
							{...programme}
						/>
					))}
				</div>
			</div>
		</section>
	);
}
