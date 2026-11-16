// The dark chapter of the second colorway: the copy and three definition rows, beside the Noir photo in an arch.
// LandingPage renders it. Its button sets the colorway to Noir for the whole page, then jumps to the reserve section.
import { useT } from "~/shared/i18n";
import type { Colorway } from "../lib/colorways";
import { CHAPTER, FIG_CAPTION, WRAP } from "../lib/type-styles";
import { PillArrow } from "./pill-arrow";
import { SectionHead } from "./section-head";

type NoirSectionProps = {
	onColorwayChange: (colorway: Colorway) => void;
};

/** Ink ground, paper text. Below 1024px the photo comes first, so the chapter opens on the lamp. */
export function NoirSection({ onColorwayChange }: NoirSectionProps) {
	const { t } = useT();
	const rows = [
		{ label: t("noir.row1Label"), value: t("noir.row1Value") },
		{ label: t("noir.row2Label"), value: t("noir.row2Value") },
		{ label: t("noir.row3Label"), value: t("noir.row3Value") },
	];
	return (
		<section
			aria-labelledby="noir-title"
			className={`${CHAPTER} overflow-clip bg-foreground text-background`}
		>
			<div
				className={`${WRAP} grid items-center gap-[clamp(2.5rem,6vw,6rem)] lg:grid-cols-[1.05fr_0.95fr]`}
			>
				<div data-reveal>
					<SectionHead
						kicker={t("noir.kicker")}
						title={t("noir.title")}
						turn={t("noir.titleTurn")}
						titleId="noir-title"
						className="[&>p]:text-(--lume-brass-light) [&_.lume-turn]:text-(--lume-brass-light)"
					/>
					<p className="mt-[1.6rem] mb-[2.4rem] max-w-[34em] text-background/70">
						{t("noir.body")}
					</p>
					<dl className="mb-[2.6rem] border-background/18 border-b">
						{rows.map((row) => (
							<div
								key={row.label}
								className="flex flex-col gap-1 border-background/18 border-t py-[0.85rem] sm:flex-row sm:items-baseline sm:gap-4"
							>
								<dt className="font-medium text-(--lume-brass-light) text-[0.78rem] uppercase tracking-[0.14em] sm:min-w-[9.5em]">
									{row.label}
								</dt>
								<dd className="text-[0.95rem] text-background/82">
									{row.value}
								</dd>
							</div>
						))}
					</dl>
					{/* A button, not a link: it changes the page state, then moves to the reserve section.
					    Safari does not focus a clicked button, so the handler picks smooth or instant itself. */}
					<button
						type="button"
						onClick={() => {
							onColorwayChange("noir");
							const prefersStill = window.matchMedia(
								"(prefers-reduced-motion: reduce)",
							).matches;
							document.getElementById("reserve")?.scrollIntoView({
								behavior: prefersStill ? "auto" : "smooth",
							});
						}}
						className="lume-btn lume-btn-paper cursor-pointer"
					>
						{t("noir.cta")}
						<PillArrow />
					</button>
				</div>
				<figure
					data-reveal
					className="relative mx-auto w-full max-w-[26rem] max-lg:order-first lg:max-w-none"
				>
					<div className="lume-glow lume-glow-dark" aria-hidden="true" />
					<div className="lume-wipe lume-arch lume-photo-shadow-dark aspect-[4/5]">
						<img
							src="/images/lamp-noir.webp"
							width={1100}
							height={1467}
							alt={t("noir.imageAlt")}
							loading="lazy"
							className="size-full object-cover"
						/>
					</div>
					<figcaption className={`${FIG_CAPTION} relative text-background/52`}>
						<span>{t("noir.caption")}</span>
						<b className="font-medium text-(--lume-brass-light)">
							{t("noir.figure")}
						</b>
					</figcaption>
				</figure>
			</div>
		</section>
	);
}
