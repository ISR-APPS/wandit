// The first screen: the photo-orbit statement of the Éclat world. A centered serif claim, four drifting photos,
// three credential badges, and one capsule. LandingPage renders it. On a wide screen useOrbitScrub ties it to the scroll:
// while the hero scrolls away, the photos turn one place, the badges bloom one by one, and the capsule warms to deep bronze.
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useOrbitScrub } from "../hooks/use-orbit-scrub";
import { PHOTOS } from "../lib/photos";
import { GUTTER, PRIMARY_CAPSULE } from "../lib/type-styles";
import { CapsuleBadge } from "./capsule-badge";
import { OrbitPhoto } from "./orbit-photo";

/** The hero <section>. The stage inside it holds the claim and the orbit layer. */
export function HeroSection() {
	const { t } = useT();
	const sectionRef = useRef<HTMLElement>(null);
	useOrbitScrub(sectionRef);
	// Each badge blooms at its own point of the scrub, from 22% to 56% of the orbit turn (--lumia-orbit, 0 to 1).
	const badges = [
		{
			key: "licensed",
			label: t("site.badgeLicensed"),
			at: "[--lumia-badge-at:0.22]",
		},
		{
			key: "since",
			label: t("site.badgeSince"),
			at: "[--lumia-badge-at:0.39]",
		},
		{
			key: "place",
			label: t("site.badgePlace"),
			at: "[--lumia-badge-at:0.56]",
		},
	];
	return (
		<section
			ref={sectionRef}
			aria-labelledby="hero-title"
			className={cn(
				"lumia-hero relative pb-[clamp(2.5rem,6vh,4.5rem)]",
				GUTTER,
			)}
		>
			<div className="lumia-hero-stage relative mx-auto flex w-full max-w-[1240px] flex-col gap-[clamp(2rem,6vw,3rem)] pt-6 lg:block lg:pt-0">
				<div className="lumia-hero-copy relative z-[3] mx-auto grid w-full max-w-[45rem] gap-[1.35rem] text-center lg:max-w-none">
					<div className="grid justify-items-center gap-4">
						<p className="font-display text-(--lumia-ink-soft) text-[clamp(1.05rem,1.8vw,1.28rem)] italic leading-[1.35]">
							{t("hero.welcome")}
						</p>
						<h1
							id="hero-title"
							className="max-w-[12ch] text-balance font-display font-normal text-[clamp(3.25rem,6.5vw,5.6rem)] leading-[1.06] tracking-[-0.01em]"
						>
							{t("hero.titleStart")}{" "}
							<span className="text-(--lumia-bronze-deep)">
								{t("hero.titleAccent")}
							</span>
							{t("hero.titleEnd")}
						</h1>
						<p className="max-w-[54ch] font-medium text-[clamp(1.0625rem,1.5vw,1.1875rem)] leading-[1.65]">
							{t("hero.lead")}
						</p>
					</div>
					<div className="grid justify-items-center gap-[1.1rem]">
						<ul
							aria-label={t("hero.badgesLabel")}
							className="m-0 flex list-none flex-wrap justify-center gap-2 p-0 sm:gap-[0.65rem]"
						>
							{badges.map((badge) => (
								<li key={badge.key}>
									<CapsuleBadge
										className={cn(
											"lumia-hero-badge max-sm:px-3.5 max-sm:text-[10.5px]",
											badge.at,
										)}
										glyphClassName="lumia-glyph-turn"
									>
										{badge.label}
									</CapsuleBadge>
								</li>
							))}
						</ul>
						<a
							href="#contact"
							className={cn(PRIMARY_CAPSULE, "lumia-hero-cta")}
						>
							{t("hero.cta")}
						</a>
					</div>
				</div>
				<div className="lumia-orbit-layer">
					<OrbitPhoto
						photo={PHOTOS.portrait}
						alt={t("hero.portraitAlt")}
						slotClassName="lumia-orbit-1"
						delayClassName="[animation-delay:0ms]"
						imageClassName="object-[center_38%]"
					/>
					<OrbitPhoto
						photo={PHOTOS.serum}
						alt={t("hero.serumAlt")}
						slotClassName="lumia-orbit-2"
						delayClassName="[animation-delay:140ms]"
						imageClassName="object-[52%_center]"
					/>
					<OrbitPhoto
						photo={PHOTOS.hands}
						alt={t("hero.handsAlt")}
						slotClassName="lumia-orbit-3"
						delayClassName="[animation-delay:280ms]"
					/>
					<OrbitPhoto
						photo={PHOTOS.ceramics}
						alt={t("hero.ceramicsAlt")}
						slotClassName="lumia-orbit-4"
						delayClassName="[animation-delay:420ms]"
						imageClassName="object-[center_42%]"
					/>
				</div>
			</div>
		</section>
	);
}
