// The opening of the page: text at 7 of 12, a square photo at 5, and a base band under both.
// The plinth of the photo crosses the seam into the text column.
// The base band prints the four figures of the studio and the itinerary of the five rooms.
// LandingPage renders it first. From 768px to 1023px the split is 6 and 6, so the photo keeps a useful size.
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { ROOMS } from "../lib/rooms";
import {
	GRID,
	INK_BUTTON,
	MICRO_CAPS_TIGHT,
	RULE_LABEL,
	TEXT_LINK,
	WRAP,
} from "../lib/type-styles";
import { Aperture } from "./aperture";
import { PlanGlyph, type PlanGlyphName } from "./plan-glyph";
import { Plinth } from "./plinth";

// The four figures of the studio, each with the glyph that names it.
const FIGURES: readonly {
	glyph: PlanGlyphName;
	valueKey: TranslationKey;
	noteKey: TranslationKey;
}[] = [
	{ glyph: "plan", valueKey: "hero.figure1Value", noteKey: "hero.figure1Note" },
	{ glyph: "room", valueKey: "hero.figure2Value", noteKey: "hero.figure2Note" },
	{
		glyph: "stair",
		valueKey: "hero.figure3Value",
		noteKey: "hero.figure3Note",
	},
	{
		glyph: "corridor",
		valueKey: "hero.figure4Value",
		noteKey: "hero.figure4Note",
	},
];

/** First screen. On a phone the order is text, itinerary, photo, figures, so the numbered index is above the fold. */
export function HeroSection() {
	const { t } = useT();
	return (
		<section className="pt-9 pb-[clamp(3.4rem,7vw,7rem)] md:pt-[clamp(3.2rem,6vw,6.2rem)] md:pb-[clamp(4rem,7vw,7rem)]">
			<div className={cn(WRAP, GRID)}>
				<div className="order-1 md:order-none md:col-span-6 md:row-start-1 lg:col-span-7">
					<p className={cn(RULE_LABEL, "mb-[clamp(1.6rem,2.6vw,2.2rem)]")}>
						{t("hero.eyebrow")}
					</p>
					<h1 className="font-display font-normal text-[clamp(2.4rem,5.4vw,4.5rem)] leading-[1.07] tracking-[-0.03em]">
						<span className="block">{t("hero.title1")}</span>
						<span className="block">{t("hero.title2")}</span>
						<span className="block text-foreground/55">{t("hero.title3")}</span>
					</h1>
					<p className="mt-[clamp(1.3rem,2vw,1.7rem)] max-w-[48ch] text-[clamp(1.02rem,1.15vw,1.18rem)] text-foreground/70 leading-[1.66]">
						{t("hero.lede")}
					</p>
					<div className="mt-[clamp(1.6rem,2.6vw,2.4rem)] flex flex-wrap items-center gap-x-8 gap-y-5">
						<a href="#contact" className={INK_BUTTON}>
							{t("hero.cta")}
						</a>
						<a href="#rooms" className={TEXT_LINK}>
							<span className="ms-warm-line border-foreground/18 border-b pb-[0.15rem]">
								{t("hero.tourLink")}
							</span>
						</a>
					</div>
				</div>

				<div className="order-3 mt-4 md:order-none md:col-span-6 md:col-start-7 md:row-start-1 md:mt-0 lg:col-span-5 lg:col-start-8">
					<Aperture
						src="/images/living-room.webp"
						alt={t("hero.imageAlt")}
						width={1600}
						height={900}
						shape="square"
						focusClassName="object-[58%_center]"
						isAboveFold
						className="md:mb-8.5"
					>
						<Plinth
							corner="seam"
							label={t("hero.plinthLabel")}
							title={t("hero.plinthTitle")}
							note={t("hero.plinthNote")}
						/>
					</Aperture>
				</div>

				<div className="order-2 md:order-none md:col-span-6 md:col-start-7 md:row-start-2 lg:col-span-5 lg:col-start-8">
					<p className={RULE_LABEL}>{t("hero.itineraryLabel")}</p>
					{/* The strip announces the itinerary. Only the room of the hero photo is inked. */}
					<ol className="mt-4 grid grid-cols-5 gap-x-1.5">
						{ROOMS.map((room, index) => (
							<li
								key={room.id}
								className={cn(
									"min-w-0 border-t-2 pt-2",
									index === 0 ? "border-primary" : "border-foreground/10",
								)}
							>
								<span className={cn(MICRO_CAPS_TIGHT, "block")}>
									{`${t("site.numberPrefix")}${room.digits}`}
								</span>
								<span
									className={cn(
										"ms-serif mt-0.5 block text-[clamp(0.84rem,1.05vw,0.98rem)] leading-tight",
										index === 0 ? "text-foreground" : "text-foreground/65",
									)}
								>
									{t(room.shortNameKey)}
								</span>
							</li>
						))}
					</ol>
				</div>

				<div className="order-4 md:order-none md:col-span-6 md:row-start-2 lg:col-span-7">
					<p className={RULE_LABEL}>{t("hero.figuresLabel")}</p>
					<ul
						data-reveal="stagger"
						className="mt-4 grid grid-cols-2 gap-x-[clamp(1.4rem,3vw,2.6rem)] gap-y-3.5"
					>
						{FIGURES.map((figure) => (
							<li
								key={figure.valueKey}
								className="flex min-w-0 items-start gap-2.5"
							>
								<PlanGlyph name={figure.glyph} />
								<span>
									<span className="block text-[0.94rem] leading-snug">
										{t(figure.valueKey)}
									</span>
									<span className="block text-[0.8rem] text-muted-foreground leading-snug tracking-[0.02em]">
										{t(figure.noteKey)}
									</span>
								</span>
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
}
