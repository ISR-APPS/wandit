// Section 01, the hearth: a tall ember photo that bleeds off the start edge, the claim, and a three-cell ledger.
// LandingPage renders it on the second ground. It reads LEDGER_CELLS of lib/content.ts.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { LEDGER_CELLS } from "../lib/content";
import { BODY_TEXT, FIGURE, SECTION_TITLE } from "../lib/type-styles";
import { Eyebrow } from "./eyebrow";
import { PhotoCaption } from "./photo-caption";

/** The hearth split. The ledger figures carry their unit as a small ember superscript. */
export function HearthSection() {
	const { t } = useT();
	return (
		<section
			id="hearth"
			aria-labelledby="hearth-title"
			className="br-section bg-card"
		>
			<div className="br-wrap br-hearth__grid">
				<figure className="br-hearth__fig" data-reveal="rise">
					<div className="br-frame br-scrim">
						<img
							src="/images/hearth-embers.webp"
							width={1100}
							height={1467}
							alt={t("hearth.photoAlt")}
							loading="lazy"
							className="br-photo"
						/>
					</div>
					<PhotoCaption asFigcaption>{t("hearth.caption")}</PhotoCaption>
				</figure>
				<div data-reveal="rise">
					<Eyebrow className="mb-[clamp(14px,1.6vw,22px)]">
						{t("hearth.eyebrow")}
					</Eyebrow>
					<h2
						id="hearth-title"
						className={cn(SECTION_TITLE, "mb-[clamp(18px,2.2vw,26px)]")}
					>
						{t("hearth.title")}
					</h2>
					<span aria-hidden="true" className="br-uline" />
					<div className="mt-[clamp(20px,2.6vw,30px)] space-y-[1.05em]">
						<p className={BODY_TEXT}>{t("hearth.body1")}</p>
						<p className={BODY_TEXT}>{t("hearth.body2")}</p>
					</div>
				</div>
			</div>

			<div
				className="br-wrap mt-[clamp(46px,7vh,86px)] grid grid-cols-1 gap-x-[clamp(18px,3vw,48px)] min-[860px]:grid-cols-3"
				data-reveal="stagger"
			>
				{LEDGER_CELLS.map((cell) => (
					<div
						key={cell.valueKey}
						className="border-(--br-hair) border-t pt-[18px] pb-5 min-[860px]:pb-0"
					>
						<p
							className={cn(
								FIGURE,
								"font-bold text-[clamp(2.1rem,4.2vw,3.3rem)] leading-none tracking-[-0.04em]",
							)}
						>
							{t(cell.valueKey)}
							<span className="ms-[0.22em] align-[0.55em] text-[0.44em] text-primary tracking-[-0.01em]">
								{t(cell.unitKey)}
							</span>
						</p>
						<p className="mt-3 max-w-[44ch] text-[clamp(12.5px,0.92vw,14px)] text-foreground/58 leading-normal min-[860px]:max-w-[26ch]">
							{t(cell.textKey)}
						</p>
					</div>
				))}
			</div>
		</section>
	);
}
