// The first screen of the home page: the opened invitation.
// LandingPage renders it. A type column on the page axis, then a tall bouquet photo that bleeds off the end edge,
// with the script word "Yes" written across its top edge. CSS lifts the column and writes the word at page load.
import { useT } from "~/shared/i18n";
import { BUTTON, BUTTON_GHOST, H1, LABEL, LEDE } from "../lib/type-styles";
import { PhotoFrame } from "./photo-frame";
import { ScriptWord } from "./script-word";

/** One fact of the row under the actions: two short lines in capitals. */
type HeroFact = {
	top: string;
	bottom: string;
};

/** The hero split: 1.1fr of type and 0.9fr of photo. Below 900px the photo comes under the type. */
export function HeroSection() {
	const { t } = useT();
	const facts: readonly HeroFact[] = [
		{ top: t("hero.factWeddingsTop"), bottom: t("hero.factWeddingsBottom") },
		{ top: t("hero.factGuestsTop"), bottom: t("hero.factGuestsBottom") },
		{ top: t("hero.factReplyTop"), bottom: t("hero.factReplyBottom") },
	];
	return (
		<section
			aria-labelledby="hero-title"
			className="voeu-hero grid items-center gap-x-[clamp(26px,4vw,60px)] gap-y-16 pt-[clamp(48px,6.5vw,92px)] pb-[clamp(24px,3vw,44px)] min-[900px]:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
		>
			<div className="max-w-[640px]">
				<p className={`${LABEL} voeu-enter`}>{t("hero.label")}</p>
				<h1
					id="hero-title"
					className={`${H1} voeu-enter voeu-enter-2 mt-[26px]`}
				>
					<span className="block">{t("hero.titleLine1")}</span>
					<span className="block">{t("hero.titleLine2")}</span>
					<span className="block text-primary">{t("hero.titleAccent")}</span>
				</h1>
				<p className={`${LEDE} voeu-enter voeu-enter-3 mt-[26px] max-w-[46ch]`}>
					{t("hero.lede")}
				</p>
				<div className="voeu-enter voeu-enter-4 mt-[34px] flex flex-wrap gap-[14px] max-[559px]:[&>a]:flex-[1_1_100%]">
					<a href="#reply" className={BUTTON}>
						{t("hero.ctaDate")}
					</a>
					<a href="#weddings" className={BUTTON_GHOST}>
						{t("hero.ctaWeddings")}
					</a>
				</div>
				<ul
					aria-label={t("hero.factsLabel")}
					className="voeu-enter voeu-enter-5 mt-10 flex flex-wrap border-(--voeu-hair) border-t"
				>
					{facts.map((fact) => (
						<li
							key={fact.top}
							className="me-[clamp(16px,1.8vw,22px)] border-(--voeu-hair) border-e pe-[clamp(16px,1.8vw,22px)] pt-4 font-bold text-[11px] text-foreground/68 uppercase leading-[1.55] tracking-[0.15em] last:me-0 last:border-e-0 last:pe-0"
						>
							<span className="block">{fact.top}</span>
							<span className="block">{fact.bottom}</span>
						</li>
					))}
				</ul>
			</div>
			<PhotoFrame
				src="/images/bouquet.webp"
				alt={t("hero.photoAlt")}
				width={1100}
				height={1467}
				caption={t("hero.photoCaption")}
				isLazy={false}
				motion="enter"
				className="max-[899px]:me-[calc(var(--voeu-pad)*-1)]"
				frameClassName="h-[clamp(340px,52vh,460px)] min-[900px]:h-[clamp(420px,70vh,660px)]"
				imageClassName="object-[50%_42%]"
				overlay={
					<ScriptWord
						word="yes"
						className="voeu-script voeu-enter-write absolute start-[9%] top-0 z-10 -translate-y-[66%] text-[clamp(4rem,8vw,7rem)] max-[899px]:start-[7%] max-[899px]:text-[clamp(4.2rem,17vw,5.4rem)]"
					/>
				}
			/>
		</section>
	);
}
