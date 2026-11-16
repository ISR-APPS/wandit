// The first screen: the steam room fills the viewport, a ground plate sits at its foot with the title,
// the two actions, and the ritual index. A caption names the room in the opposite corner.
// LandingPage renders it first. ThresholdStrip closes it under the photo.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { PHOTOS } from "../lib/photos";
import { GHOST_BUTTON, LABEL, PRIMARY_BUTTON, WRAP } from "../lib/styles";
import { RitualIndex } from "./ritual-index";
import { SteamVeil } from "./steam-veil";
import { ThresholdStrip } from "./threshold-strip";

/** The hero <section>. The photo loads first, as it is the largest paint of the page. */
export function HeroSection() {
	const { t } = useT();
	return (
		<section aria-labelledby="hero-title" className="relative">
			<div className="onde-photo onde-hero-photo flex min-h-svh items-end">
				<img
					src={PHOTOS.steamRoom.src}
					alt={t("hero.photoAlt")}
					width={PHOTOS.steamRoom.width}
					height={PHOTOS.steamRoom.height}
					fetchPriority="high"
					decoding="async"
					className="object-[77%_50%]"
				/>
				<SteamVeil kind="head" phase={0} />
				<div
					className={cn(
						WRAP,
						"relative z-3 pt-[clamp(6rem,14vh,9rem)] pb-[clamp(4.5rem,11vh,7.5rem)]",
					)}
				>
					<div className="rounded-lg bg-background px-[clamp(1.5rem,2.8vw,2.8rem)] pt-[clamp(1.6rem,2.8vw,2.6rem)] pb-[clamp(1.5rem,2.4vw,2.2rem)] lg:max-w-[min(680px,74%)]">
						<p className={LABEL}>{t("hero.label")}</p>
						<h1
							id="hero-title"
							className="mt-[1.1rem] max-w-[11ch] text-balance font-display font-normal text-[clamp(2.6rem,5vw,4.6rem)] leading-[1.04] tracking-[-0.008em]"
						>
							{t("hero.title")}
						</h1>
						<p className="mt-[1.2rem] max-w-[40ch] text-(--onde-ink-72) text-[clamp(1.02rem,1.18vw,1.2rem)] leading-[1.68]">
							{t("hero.lead")}
						</p>
						<div className="mt-[1.9rem] flex flex-wrap gap-[0.85rem]">
							<a href="#book" className={PRIMARY_BUTTON}>
								{t("hero.primaryCta")}
							</a>
							<a href="#treatments" className={GHOST_BUTTON}>
								{t("hero.secondaryCta")}
							</a>
						</div>
						<RitualIndex />
					</div>
				</div>
				<p
					data-side="end"
					className="onde-caption font-sans text-[0.73rem] text-primary tabular-nums tracking-[0.18em]"
				>
					{t("hero.caption")}
				</p>
			</div>
			<ThresholdStrip />
		</section>
	);
}
