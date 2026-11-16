// Section 02, "the line": the showpiece. Four panoramas share one horizon; one sun rule lies over all of them.
// LandingPage renders it on the sable ground. useLineScrub moves the strip sideways while the stage stays on screen.
// Under 900px, with reduced motion, or with no script, the strip is a native scroll-snap panorama with a swipe hint.
import { useRef } from "react";
import { type TranslationKey, useT } from "~/shared/i18n";
import { useLineScrub } from "../hooks/use-line-scrub";
import { PHOTOS, type Photo, type PhotoLock } from "../lib/photos";
import { CAPTION, META_SMALL, WRAP } from "../lib/type-styles";
import { LockedPhoto } from "./locked-photo";
import { SectionHead } from "./section-head";

/** One panel of the strip. The lock puts each horizon at 34% of the panel height. */
type Panel = {
	id: string;
	photo: Photo;
	lock: PhotoLock;
	altKey: TranslationKey;
	/** Place and distance from Algiers by road, for the caption rail. */
	captionKey: TranslationKey;
};

/** The four panels, from the sea to the ksar. The sea and the ksar use tx to crop sideways. */
const PANELS: readonly Panel[] = [
	{
		id: "sea",
		photo: PHOTOS.sea,
		// The crop keeps the left third of the photo, open sea and sky. It leaves out the town and its church.
		lock: { k: 4, ty: -5.4, tx: 30 },
		altKey: "line.seaAlt",
		captionKey: "line.seaCaption",
	},
	{
		id: "cove",
		photo: PHOTOS.cove,
		lock: { k: 1.35, ty: -2.1 },
		altKey: "line.coveAlt",
		captionKey: "line.coveCaption",
	},
	{
		id: "dunes",
		photo: PHOTOS.dunes,
		lock: { k: 1.75, ty: -3.4 },
		altKey: "line.dunesAlt",
		captionKey: "line.dunesCaption",
	},
	{
		id: "ksar",
		photo: PHOTOS.ksar,
		lock: { k: 3.4, ty: -56, tx: 12 },
		altKey: "line.ksarAlt",
		captionKey: "line.ksarCaption",
	},
];

/** The tall scroll scene. The sun rule never moves: the land moves under it. */
export function LineSection() {
	const { t } = useT();
	const sectionRef = useRef<HTMLElement>(null);
	const windowRef = useRef<HTMLElement>(null);
	useLineScrub(sectionRef, windowRef);
	return (
		<section
			ref={sectionRef}
			id="line"
			aria-labelledby="line-title"
			className="hz-line hz-sable"
		>
			<div className="hz-line-stage">
				<div className="w-full pt-[clamp(4.5rem,9vh,6rem)] pb-[clamp(2.6rem,5vh,3.4rem)]">
					<div className={WRAP}>
						<SectionHead
							label={t("line.label")}
							title={t("line.title")}
							titleId="line-title"
							note={t("line.note")}
						/>
					</div>
					{/* The sun rule is a sibling of the window, so it stays still while the panels move under it. */}
					<div className="relative">
						<span aria-hidden="true" className="hz-line-rule" />
						{/* The window is a native scroll area by default. tabIndex lets a keyboard user scroll it. useLineScrub removes the stop while the scrub clips it. */}
						<section
							ref={windowRef}
							className="hz-line-window"
							aria-label={t("line.stripLabel")}
							// biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll area must take focus so the arrow keys can scroll it.
							tabIndex={0}
						>
							<div className="hz-line-track">
								{PANELS.map((panel) => (
									<figure key={panel.id} className="hz-line-panel">
										<LockedPhoto
											photo={panel.photo}
											lock={panel.lock}
											alt={t(panel.altKey)}
											className="hz-line-frame"
										/>
										<figcaption className={CAPTION}>
											{t(panel.captionKey)}
										</figcaption>
									</figure>
								))}
							</div>
						</section>
					</div>
					<div className={WRAP}>
						<div className="mt-[clamp(20px,2.4vw,26px)] flex flex-wrap items-center gap-x-[clamp(16px,3vw,40px)] gap-y-2">
							<p className={META_SMALL}>{t("line.footer")}</p>
							<p className={`${META_SMALL} hz-line-swipe`}>
								{t("line.swipe")}{" "}
								<span
									aria-hidden="true"
									className="inline-block rtl:rotate-180"
								>
									{t("site.arrow")}
								</span>
							</p>
							<div aria-hidden="true" className="hz-line-progress">
								<span />
							</div>
							<p className={`${META_SMALL} ms-auto`}>{t("line.views")}</p>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
