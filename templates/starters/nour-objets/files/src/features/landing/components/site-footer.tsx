// The footer of the page: four columns with the shop, the address, the opening hours, and the contact lines.
// LandingPage renders it. It reads the "footer" and "site" groups of messages.ts.
import { useT } from "~/shared/i18n";
import { CONTACT_LINK, LEDGER_LABEL, MONO, WRAP } from "../lib/type-styles";

const COLUMN_TEXT = "mt-1.5 text-[14px] leading-[1.45]";

/** One ink rule opens it. Four columns from 821px. Below, the shop, the address and hours, and the contact take a row each. */
export function SiteFooter() {
	const { t } = useT();
	return (
		<footer className="border-foreground border-t py-[clamp(2.4rem,4vh,3.4rem)]">
			<div className={WRAP}>
				<div className="grid grid-cols-2 gap-6 min-[821px]:grid-cols-4">
					{/* Below 821px the shop and the contact take a full row each, so the two contact links share one line. */}
					<div className="col-span-2 min-[821px]:col-span-1">
						<h2 className={LEDGER_LABEL}>{t("footer.shopLabel")}</h2>
						<p className={COLUMN_TEXT}>
							{t("footer.shopLine1")}
							<br />
							{t("footer.shopLine2")}
						</p>
					</div>
					<div>
						<h2 className={LEDGER_LABEL}>{t("footer.addressLabel")}</h2>
						<p className={COLUMN_TEXT}>
							{t("site.address1")}
							<br />
							{t("site.address2")}
						</p>
					</div>
					<div>
						<h2 className={LEDGER_LABEL}>{t("footer.openingLabel")}</h2>
						<p className={COLUMN_TEXT}>
							{t("site.hours1")}
							<br />
							{t("site.hours2")}
						</p>
					</div>
					<div className="col-span-2 min-[821px]:col-span-1">
						<h2 className={LEDGER_LABEL}>{t("footer.contactLabel")}</h2>
						{/* A phone keeps the 44px touch boxes side by side. -mt-1.5 puts the words on the line of the other columns. */}
						<div className="-mt-1.5 flex flex-wrap gap-x-6 text-[14px] min-[821px]:mt-1.5 min-[821px]:flex-col min-[821px]:items-start min-[821px]:leading-[1.45]">
							<a
								href={t("site.phoneHref")}
								className={`${CONTACT_LINK} min-[821px]:min-h-0`}
							>
								{t("site.phone")}
							</a>
							<a
								href={t("site.emailHref")}
								className={`${CONTACT_LINK} break-all min-[821px]:min-h-0`}
							>
								{t("site.email")}
							</a>
						</div>
					</div>
				</div>
				<div className="mt-[clamp(28px,4vh,44px)] flex flex-wrap justify-between gap-x-[18px] gap-y-1 border-foreground/9 border-t pt-3.5">
					<span className={MONO}>{t("footer.legal")}</span>
					<span className={MONO}>{t("footer.prices")}</span>
				</div>
			</div>
		</footer>
	);
}
