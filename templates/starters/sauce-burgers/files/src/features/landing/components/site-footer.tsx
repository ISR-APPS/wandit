// The footer on the ink ground: the wordmark at monument size, four contact columns, and one legal line.
// LandingPage renders it after <main>. It is the only ink ground of the page.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { DISPLAY_TEXT, LABEL_TEXT, WRAP } from "../lib/type-styles";
import { DripEdge } from "./drip-edge";
import { FooterLink } from "./footer-link";

const HEAD_CLASS = cn(
	LABEL_TEXT,
	"mb-1.5 text-background/65 tracking-[0.12em]",
);

/** No form and no credit line. Every link is an anchor of the page or a tel: link. */
export function SiteFooter() {
	const { t } = useT();
	return (
		<footer className="sc-on-hot relative overflow-hidden bg-foreground pt-[clamp(66px,9vh,110px)] pb-8.5 text-background">
			<DripEdge variant="a" tone="hot" />
			<div className={WRAP}>
				<p
					className={cn(
						DISPLAY_TEXT,
						"mb-[clamp(20px,3vh,34px)] text-[clamp(3.6rem,9.4vw,8.6rem)] leading-[0.82]",
					)}
				>
					{t("site.brand")}
					<span className="text-primary">!</span>
				</p>
				<div className="grid gap-x-[clamp(18px,4vw,60px)] gap-y-5 border-background/28 border-t-2 pt-5.5 text-[0.92rem] sm:grid-cols-2 lg:grid-cols-[auto_auto_auto_auto] lg:justify-between">
					<div>
						<p className={HEAD_CLASS}>{t("footer.addressHead")}</p>
						<p>
							{t("footer.addressLine1")}
							<br />
							{t("footer.addressLine2")}
						</p>
					</div>
					<div>
						<p className={HEAD_CLASS}>{t("footer.phoneHead")}</p>
						<FooterLink
							href={t("site.phoneHref")}
							label={t("site.phoneDisplay")}
						/>
					</div>
					<div>
						<p className={HEAD_CLASS}>{t("footer.hoursHead")}</p>
						<p>
							{t("footer.hoursLine1")}
							<br />
							{t("footer.hoursLine2")}
						</p>
					</div>
					<div>
						<p className={HEAD_CLASS}>{t("footer.menuHead")}</p>
						<ul>
							<li>
								<FooterLink href="#menu" label={t("footer.menuBurgers")} />
							</li>
							<li>
								<FooterLink href="#shakes" label={t("footer.menuShakes")} />
							</li>
						</ul>
					</div>
				</div>
				<p className="mt-6.5 text-[11px] text-background/60 tracking-[0.05em]">
					{t("footer.legal")}
				</p>
			</div>
		</footer>
	);
}
