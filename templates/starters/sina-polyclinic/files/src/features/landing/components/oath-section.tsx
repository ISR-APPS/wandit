// The oath: five commitments of the clinic on a quiet band, each one a kicker and one serif sentence.
// LandingPage renders it. A soft vitals line opens the band, and the instrument tray photo closes the title column.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { COMMITMENT_IDS } from "../lib/content";
import { LABEL, WRAP } from "../lib/type-styles";
import { PhotoPlate } from "./photo-plate";
import { PulseGlyph } from "./pulse-glyph";
import { TitleColumn } from "./title-column";
import { VitalsLine } from "./vitals-line";

/**
 * The section with the id "oath". The rows share the height of the title column,
 * so the last hairline of the list lands on the foot of the signature.
 */
export function OathSection() {
	const { t } = useT();
	return (
		<section
			id="oath"
			aria-labelledby="oath-title"
			className="sp-quiet scroll-mt-16 pt-2 pb-(--sp-rhythm)"
		>
			<VitalsLine
				entrance="scroll"
				className="mb-[clamp(30px,4vw,54px)] text-primary opacity-40"
			/>
			<div
				className={cn(
					WRAP,
					"grid gap-[clamp(28px,4vw,64px)] min-[56.25rem]:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]",
				)}
			>
				<TitleColumn
					tone="quiet"
					label={t("oath.label")}
					title={t("oath.title")}
					titleId="oath-title"
					body={t("oath.body")}
					signLine={t("oath.signLine")}
					signNote={t("oath.signNote")}
				>
					<PhotoPlate
						src="/images/instrument-tray.webp"
						alt={t("oath.photoAlt")}
						width={1433}
						height={1920}
						caption={t("oath.photoCaption")}
						className="mt-[clamp(26px,3vw,38px)] max-w-130 min-[56.25rem]:max-w-none"
						frameClassName="aspect-square"
						imageClassName="object-[50%_70%]"
					/>
				</TitleColumn>
				{/* mt-2: the first hairline of the list lands on the hairline of the section label beside it. */}
				<ol className="flex flex-col border-foreground/12 border-t min-[56.25rem]:mt-2">
					{COMMITMENT_IDS.map((id) => (
						<li
							key={id}
							data-reveal="rise"
							className="grid flex-1 content-start gap-2.5 border-foreground/12 border-b py-[clamp(22px,2.6vw,32px)] md:grid-cols-[150px_minmax(0,1fr)] md:gap-[clamp(14px,2.5vw,34px)]"
						>
							<p
								className={cn(
									LABEL,
									"flex items-center gap-2 text-(--sp-teal-deep) tracking-[0.14em] md:h-[clamp(1.58rem,2.55vw,2.2rem)]",
								)}
							>
								<PulseGlyph className="h-2.5 w-4.5 shrink-0" />
								{t(`oath.${id}.kicker`)}
							</p>
							<p className="font-display text-[clamp(1.15rem,1.85vw,1.6rem)] leading-[1.38] tracking-[-0.012em]">
								{t(`oath.${id}.sentence`)}
							</p>
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}
