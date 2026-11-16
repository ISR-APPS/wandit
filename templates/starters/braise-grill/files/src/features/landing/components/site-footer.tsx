// The footer of the Braise page: three hairline columns, a full-width ember rule, and the wordmark monument.
// LandingPage renders it last, on the slate ground.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { MICRO_LABEL } from "../lib/type-styles";

const COLUMN_TEXT =
	"text-[clamp(13px,0.98vw,15px)] text-foreground/72 leading-[1.7]";

/** The monument is capped at 150px: a signature at the foot of a letter, not a billboard. */
export function SiteFooter() {
	const { t } = useT();
	return (
		<footer className="border-(--br-hair) border-t bg-canvas pt-[clamp(3.5rem,7vh,6rem)]">
			<div className="br-wrap grid grid-cols-1 gap-[26px] min-[860px]:grid-cols-3 min-[860px]:gap-[clamp(20px,3vw,48px)]">
				<div>
					<h2 className={cn(MICRO_LABEL, "mb-3.5 tracking-[0.16em]")}>
						{t("footer.houseTitle")}
					</h2>
					<p className={COLUMN_TEXT}>
						{t("footer.houseLine1")}
						<br />
						{t("footer.houseLine2")}
						<br />
						{t("footer.houseLine3")}
					</p>
				</div>
				<div>
					<h2 className={cn(MICRO_LABEL, "mb-3.5 tracking-[0.16em]")}>
						{t("footer.hoursTitle")}
					</h2>
					<p className={cn(COLUMN_TEXT, "tabular-nums")}>
						{t("footer.hoursLine1")}
						<br />
						{t("footer.hoursLine2")}
						<br />
						{t("footer.hoursLine3")}
					</p>
				</div>
				<div>
					<h2 className={cn(MICRO_LABEL, "mb-3.5 tracking-[0.16em]")}>
						{t("footer.contactTitle")}
					</h2>
					{/* On a phone each link gets a 44px touch area. On a desktop it keeps the line rhythm of the other columns. */}
					<ul className={COLUMN_TEXT}>
						<li>
							<a
								href={t("site.phoneHref")}
								className="br-link inline-flex items-center hover:text-foreground focus-visible:text-foreground max-[859px]:min-h-11"
							>
								{t("site.phoneDisplay")}
							</a>
						</li>
						<li>
							<a
								href={t("site.emailHref")}
								className="br-link inline-flex items-center break-all hover:text-foreground focus-visible:text-foreground max-[859px]:min-h-11"
							>
								{t("site.email")}
							</a>
						</li>
						<li>
							<a
								href="#book"
								className="br-link inline-flex items-center hover:text-foreground focus-visible:text-foreground max-[859px]:min-h-11"
							>
								{t("footer.bookLink")}
							</a>
						</li>
					</ul>
				</div>
			</div>
			<div className="br-wrap mt-[clamp(38px,6vh,68px)]">
				<span aria-hidden="true" className="br-uline br-uline--full" />
			</div>
			<p
				aria-hidden="true"
				className="br-monument mt-[clamp(18px,3.2vh,34px)] text-center font-display font-extrabold text-foreground/20 uppercase"
			>
				{t("site.brand")}
			</p>
			<div className="br-wrap">
				<div className="mt-[clamp(18px,3vh,30px)] flex flex-wrap justify-between gap-x-[18px] gap-y-2 border-(--br-hair) border-t pt-[22px] pb-[26px] text-foreground/45 text-xs tracking-[0.04em]">
					<span>{t("footer.copyright")}</span>
					<span>{t("footer.fineprint")}</span>
				</div>
			</div>
		</footer>
	);
}
