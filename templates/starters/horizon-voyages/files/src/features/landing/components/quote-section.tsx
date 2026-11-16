// Section 05, the contact close: the boarding pass beside a practical column (address, telephone, hours, licence).
// LandingPage renders it on the paper ground, so the pass can carry the sable ground.
import { useT } from "~/shared/i18n";
import { META_SMALL, SECTION, WRAP } from "../lib/type-styles";
import { BoardingPass } from "./boarding-pass";
import { SectionHead } from "./section-head";

/** The quote section. Two columns from 900px; the practical column follows the pass on a phone. */
export function QuoteSection() {
	const { t } = useT();
	return (
		<section
			id="quote"
			aria-labelledby="quote-title"
			className={`${SECTION} bg-background`}
		>
			<div className={WRAP}>
				<SectionHead
					label={t("quote.label")}
					title={t("quote.title")}
					titleId="quote-title"
					note={t("quote.note")}
				/>
				<div className="grid items-start gap-x-[clamp(28px,4.5vw,72px)] gap-y-12 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,330px)]">
					<div data-reveal className="hz-rise">
						<BoardingPass />
					</div>
					<div data-reveal className="hz-rise">
						<dl className="grid gap-[22px]">
							<div>
								<dt className={META_SMALL}>{t("quote.agencyLabel")}</dt>
								<dd className="mt-1.5 text-[15px] leading-[1.6]">
									{t("quote.agencyLine1")}
									<br />
									{t("quote.agencyLine2")}
								</dd>
							</div>
							{/* A link row keeps its 44px touch box. The negative margins put its text at the rhythm of the plain rows. */}
							<div>
								<dt className={META_SMALL}>{t("site.phoneLabel")}</dt>
								<dd className="-my-1.5">
									<a
										href={t("site.phoneHref")}
										className="inline-flex min-h-11 items-center font-display text-[1.3rem] tabular-nums"
									>
										<span className="hz-underline">
											{t("site.phoneDisplay")}
										</span>
									</a>
								</dd>
							</div>
							<div>
								<dt className={META_SMALL}>{t("quote.emailLabel")}</dt>
								<dd className="-my-1.5">
									<a
										href={t("site.emailHref")}
										className="inline-flex min-h-11 items-center break-all text-[15px]"
									>
										<span className="hz-underline">
											{t("site.emailDisplay")}
										</span>
									</a>
								</dd>
							</div>
							<div>
								<dt className={META_SMALL}>{t("quote.hoursLabel")}</dt>
								<dd className="mt-1.5 text-[15px] leading-[1.6]">
									{t("quote.hoursValue")}
								</dd>
							</div>
							<div>
								<dt className={META_SMALL}>{t("quote.licenceLabel")}</dt>
								<dd className="mt-1.5 text-[15px] tabular-nums leading-[1.6]">
									{t("quote.licenceValue")}
								</dd>
							</div>
						</dl>
					</div>
				</div>
			</div>
		</section>
	);
}
