// The imprint of the paper (the footer): a 4px ink bar, address, hours, and contact, the staff paragraph,
// and the edition line. LandingPage renders it last. It has no "made with" credit and no giant wordmark.
import type { ReactNode } from "react";
import type { TranslationKey } from "~/shared/i18n";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { DATELINE, FURNITURE, PROSE_LINK } from "../lib/type-styles";

const ADDRESS_LINES: readonly TranslationKey[] = [
	"imprint.addressLine1",
	"imprint.addressLine2",
	"imprint.addressLine3",
];
const HOURS_LINES: readonly TranslationKey[] = [
	"imprint.hoursLine1",
	"imprint.hoursLine2",
	"imprint.hoursLine3",
];

/** The printer's block on the deeper stock. */
export function ImprintFooter() {
	const { t } = useT();
	return (
		<footer className="border-foreground border-t-4 bg-canvas pt-[clamp(2.5rem,6vh,4rem)] pb-6">
			<div className="ks-wrap">
				<div className="mb-9 grid gap-8 min-[640px]:grid-cols-3">
					<FooterColumn titleKey="imprint.addressTitle">
						{ADDRESS_LINES.map((key) => (
							<span key={key} className="block">
								{t(key)}
							</span>
						))}
					</FooterColumn>
					<FooterColumn titleKey="imprint.hoursTitle">
						{HOURS_LINES.map((key) => (
							<span key={key} className="block">
								{t(key)}
							</span>
						))}
					</FooterColumn>
					<FooterColumn titleKey="imprint.contactTitle">
						{/* The negative margin cancels the centering offset of the 44px target, so the first lines align. */}
						<a
							href={t("site.phoneHref")}
							className={cn(
								PROSE_LINK,
								"-mt-2.5 flex min-h-11 w-fit items-center",
							)}
						>
							{t("site.phoneDisplay")}
						</a>
						<a
							href={t("site.emailHref")}
							className={cn(
								PROSE_LINK,
								"flex min-h-11 w-fit items-center break-all",
							)}
						>
							{t("site.email")}
						</a>
					</FooterColumn>
				</div>
				<div className="border-(--ks-rule) border-t pt-5">
					<p className="max-w-[88ch] text-[0.9rem] text-foreground/85 leading-relaxed">
						<span className={DATELINE}>{t("imprint.imprintLead")}</span>{" "}
						{t("imprint.imprintBody")}
					</p>
				</div>
				<div
					className={cn(
						FURNITURE,
						"mt-6 flex flex-wrap justify-between gap-x-6 gap-y-1.5 border-(--ks-rule) border-t pt-3 font-medium text-[0.7rem] text-foreground/62 tracking-[0.09em]",
					)}
				>
					<span>{t("imprint.copyright")}</span>
					<span>{t("imprint.priceLine")}</span>
				</div>
			</div>
		</footer>
	);
}

/** One caps column of the imprint. */
function FooterColumn({
	titleKey,
	children,
}: {
	titleKey: TranslationKey;
	children: ReactNode;
}) {
	const { t } = useT();
	return (
		<div>
			<h2 className="mb-2.5 font-bold font-sans text-[0.74rem] text-primary uppercase tracking-[0.14em]">
				{t(titleKey)}
			</h2>
			<p className="text-[0.95rem] leading-relaxed">{children}</p>
		</div>
	);
}
