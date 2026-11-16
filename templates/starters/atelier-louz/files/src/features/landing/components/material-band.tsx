// The marquee band of material names between two hairlines, with a small arch between names.
// LandingPage renders it under the hero. The loop is a CSS keyframe of 32 s; reduced motion stops it.
import { Fragment } from "react";
import { useT } from "~/shared/i18n";

// The band also names lime and terracotta: the studio uses them, but the cabinet shows only six samples.
const BAND_KEYS = [
	"band.lime",
	"band.tadelakt",
	"band.zellige",
	"band.walnut",
	"band.brass",
	"band.linen",
	"band.terracotta",
	"band.alfa",
] as const;

// Each half of the track holds the names twice, so one half is wider than a 2560 px screen.
const HALF_REPEATS = [0, 1];

/** The material marquee. Screen readers read the first list once; the copies are hidden from them. */
export function MaterialBand() {
	const { t } = useT();
	const names = BAND_KEYS.map((key) => t(key));
	return (
		<section
			aria-label={t("band.label")}
			className="overflow-hidden border-(--louz-hair) border-y py-4"
		>
			<div className="louz-band-track">
				{[0, 1].map((half) => (
					<ul
						key={half}
						aria-hidden={half === 1 ? true : undefined}
						className="flex shrink-0 items-center"
					>
						{HALF_REPEATS.map((repeat) =>
							names.map((name) => (
								<Fragment key={`${repeat}-${name}`}>
									<li
										aria-hidden={repeat === 1 ? true : undefined}
										className="whitespace-nowrap px-6 font-display text-[clamp(1.25rem,2.2vw,1.7rem)]"
									>
										{name}
									</li>
									<li aria-hidden="true" className="shrink-0">
										<svg
											width="20"
											height="13"
											viewBox="0 0 20 13"
											aria-hidden="true"
											focusable="false"
										>
											<path
												className="louz-tint-stroke"
												d="M2 13V9A8 8 0 0 1 18 9v4"
												fill="none"
												strokeWidth="2.4"
											/>
										</svg>
									</li>
								</Fragment>
							)),
						)}
					</ul>
				))}
			</div>
		</section>
	);
}
