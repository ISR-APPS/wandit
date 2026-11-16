// Section 04: the photographer and the method, beside one tall photograph.
// landing-page.tsx renders it. It reads the "about" group of messages.ts.
// A mono list of the equipment closes the text, in two columns.
import { useT } from "~/shared/i18n";
import { CAPTION, H2, KICKER, LABEL, PROSE, WRAP } from "../lib/styles";
import { CutGroup } from "./cut-group";
import { PhotoFrame } from "./photo-frame";

/** A panel section: one step lighter than the page ground, between two hairlines. */
export function AboutSection() {
	const { t } = useT();
	const gear = [
		{ label: t("about.bodiesLabel"), value: t("about.bodiesValue") },
		{ label: t("about.lensesLabel"), value: t("about.lensesValue") },
		{ label: t("about.filmLabel"), value: t("about.filmValue") },
		{ label: t("about.labLabel"), value: t("about.labValue") },
	];
	return (
		<section
			id="about"
			aria-labelledby="about-title"
			className="border-foreground/15 border-y bg-card py-(--yr-section)"
		>
			<CutGroup
				className={`${WRAP} grid items-start gap-7 min-[861px]:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] min-[861px]:gap-[clamp(24px,4vw,70px)]`}
			>
				<figure className="yr-cut">
					<PhotoFrame
						photo="cafe"
						number="08"
						exif="full"
						className="aspect-[16/11] min-[861px]:aspect-[3/4]"
						// In the tall crop, 82% keeps the marble table and the glass of tea in the frame.
						imageClassName="min-[861px]:object-[82%_50%]"
					/>
					<figcaption className={CAPTION}>
						<span className="text-foreground">{t("about.captionPlace")}</span>
						{" — "}
						{t("about.captionDate")}
					</figcaption>
				</figure>
				<div className="yr-cut [--cut:1]">
					<p className={KICKER}>{t("about.kicker")}</p>
					<h2 id="about-title" className={`${H2} mt-3.5`}>
						{t("about.title")}
					</h2>
					<p className={`${PROSE} mt-[26px] max-w-[56ch]`}>
						{t("about.paragraph1")}
					</p>
					<p className={`${PROSE} mt-[1.05em] max-w-[56ch]`}>
						{t("about.paragraph2")}
					</p>
					<dl className="mt-[clamp(1.6rem,3vh,2.4rem)] grid gap-x-[clamp(18px,2.6vw,40px)] border-foreground/15 border-t min-[521px]:grid-cols-2">
						{gear.map((item) => (
							<div
								key={item.label}
								className="border-foreground/15 border-b pt-4 pb-1"
							>
								<dt className={LABEL}>{item.label}</dt>
								<dd className="mt-1.5 mb-3 text-[0.98rem]">{item.value}</dd>
							</div>
						))}
					</dl>
				</div>
			</CutGroup>
		</section>
	);
}
