// The Grin Club badge: a 32-point sun starburst with a cream center that names the price.
// ClubSection renders it; it wobbles a few degrees (landing.css .gd-wobble). Its label states the price in words.
import { useT } from "~/shared/i18n";

const STARBURST =
	"M0,-140 L18,-108 L52,-130 L58,-93 L96,-101 L88,-64 L127,-58 L106,-27 L140,-9 L110,14 L132,45 L95,55 L104,93 L66,88 L61,127 L28,107 L0,140 L-28,107 L-61,127 L-66,88 L-104,93 L-95,55 L-132,45 L-110,14 L-140,-9 L-106,-27 L-127,-58 L-88,-64 L-96,-101 L-58,-93 L-52,-130 L-18,-108 Z";

/** A 300 x 300 drawing that fills the width of its parent. */
export function ClubBadge() {
	const { t } = useT();
	return (
		<svg
			viewBox="0 0 300 300"
			role="img"
			aria-label={t("club.badgeLabel")}
			className="gd-wobble h-auto w-full"
		>
			<g transform="translate(150 150)">
				<path
					d={STARBURST}
					transform="translate(6 8)"
					className="fill-foreground"
				/>
				<path
					d={STARBURST}
					strokeWidth="5"
					strokeLinejoin="round"
					className="fill-(--gd-sun) stroke-foreground"
				/>
				<circle
					r="92"
					strokeWidth="4"
					className="fill-background stroke-foreground"
				/>
				<text
					y="-38"
					textAnchor="middle"
					className="fill-(--gd-teal) font-bold font-display text-[17px] tracking-[0.14em]"
				>
					{t("club.badgeTop")}
				</text>
				<text
					y="24"
					textAnchor="middle"
					className="fill-primary font-display font-extrabold text-[58px]"
				>
					{t("club.badgePrice")}
				</text>
				<text
					y="52"
					textAnchor="middle"
					className="fill-foreground font-bold font-display text-[16px]"
				>
					{t("club.badgeUnit")}
				</text>
				<text
					y="72"
					textAnchor="middle"
					className="fill-foreground font-extrabold font-sans text-[9.5px] tracking-[0.05em]"
				>
					{t("club.badgeFoot")}
				</text>
			</g>
		</svg>
	);
}
