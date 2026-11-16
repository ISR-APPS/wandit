// Section 03, the hand: an eyebrow row, the chef claim, then a carving photo that bleeds off the end edge.
// LandingPage renders it on the second ground. It reads CHEF_FACTS of lib/content.ts.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { CHEF_FACTS } from "../lib/content";
import { BODY_TEXT } from "../lib/type-styles";
import { Eyebrow } from "./eyebrow";
import { FactList } from "./fact-list";
import { PhotoCaption } from "./photo-caption";

/** The people section. The hairline eyebrow row is used once on the page, here. */
export function ChefSection() {
	const { t } = useT();
	return (
		<section
			id="chef"
			aria-labelledby="chef-title"
			className="br-section bg-card"
		>
			<div className="br-wrap" data-reveal="rise">
				<div className="mb-[clamp(22px,3vw,34px)] flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2 border-(--br-hair) border-b pb-3.5">
					<Eyebrow>{t("chef.eyebrow")}</Eyebrow>
					<Eyebrow className="text-foreground/40">{t("chef.meta")}</Eyebrow>
				</div>
				<h2
					id="chef-title"
					className="mb-[clamp(30px,5vh,54px)] max-w-[20ch] text-balance font-bold font-display text-[clamp(2.05rem,4.6vw,3.7rem)] leading-[1.02] tracking-[-0.025em]"
				>
					{t("chef.title")}
				</h2>
			</div>
			<div className="br-wrap br-chef__grid">
				<figure className="br-chef__fig" data-reveal="rise">
					<div className="br-frame br-scrim">
						<img
							src="/images/carving-board.webp"
							width={1100}
							height={1467}
							alt={t("chef.photoAlt")}
							loading="lazy"
							className="br-photo"
						/>
					</div>
					<PhotoCaption asFigcaption>{t("chef.caption")}</PhotoCaption>
				</figure>
				<div className="br-chef__body" data-reveal="stagger">
					<p className="max-w-[19ch] font-display font-medium text-[clamp(1.35rem,2.5vw,2.05rem)] leading-[1.16] tracking-[-0.025em] max-[859px]:max-w-[26ch]">
						{t("chef.pull")}
					</p>
					<p className={cn(BODY_TEXT, "mt-[clamp(20px,2.6vw,30px)]")}>
						{t("chef.body1")}
					</p>
					<p className={cn(BODY_TEXT, "mt-[1.05em]")}>{t("chef.body2")}</p>
					<FactList
						facts={CHEF_FACTS}
						className="mt-[clamp(26px,3.4vw,40px)]"
					/>
				</div>
			</div>
		</section>
	);
}
