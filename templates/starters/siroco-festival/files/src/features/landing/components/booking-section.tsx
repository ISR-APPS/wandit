// The booking sheet, the last sheet before the footer. A fitted shout, the box office telephone in big numerals,
// the email, and the three steps of a booking. It posts no data: the actions are a tel: and a mailto: link.
// LandingPage renders it on vermilion, before the ink footer. A flat arrow points to the booking steps.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { BOOKING_STEPS } from "../lib/content";
import { LABEL, LINK, SHEET_PAD, WRAP } from "../lib/type-styles";
import { ArrowGlyph } from "./arrow-glyph";
import { FittedLine } from "./fitted-line";

/** Fit share of the shout, measured for Anton caps. The box is one column wide from 1024px. */
const SHOUT_FIT = 0.1985;

/** Two columns from 1024px: the shout and the arrow at the start, the box office at the end. */
export function BookingSection() {
	const { t } = useT();
	return (
		<section
			id="book"
			aria-labelledby="book-title"
			className="sf-vermilion relative overflow-clip"
		>
			<div
				className={cn(
					WRAP,
					SHEET_PAD,
					"grid items-start gap-x-[clamp(2.5rem,6vw,6rem)] gap-y-12 lg:grid-cols-2",
				)}
			>
				<div data-slab="">
					<p className={LABEL}>{t("booking.label")}</p>
					<h2 id="book-title" className="mt-6 mb-7">
						<FittedLine text={t("booking.shout")} fit={SHOUT_FIT} />
					</h2>
					<p className="max-w-[28em] text-[clamp(1.02rem,1.3vw,1.2rem)]">
						{t("booking.body")}
					</p>
					<ArrowGlyph className="ms-auto -me-6 mt-12 hidden h-auto w-[clamp(14rem,24vw,22rem)] lg:block" />
				</div>
				<div data-slab="" className="[--sf-i:1]">
					<p className={LABEL}>{t("booking.callLabel")}</p>
					<a
						href={t("site.phoneHref")}
						className="sf-link mt-4 inline-block border-b-0 font-display text-[clamp(2.7rem,5.6vw,5rem)] tabular-nums leading-[1.05] tracking-[0.01em]"
					>
						{t("site.phoneDisplay")}
					</a>
					<p className="mt-7 font-bold text-[0.8rem] uppercase tracking-[0.07em]">
						{t("booking.writeLabel")}
					</p>
					<a
						href={t("site.emailHref")}
						className={cn(
							LINK,
							"mt-2 inline-block break-all text-[clamp(1.05rem,1.6vw,1.3rem)]",
						)}
					>
						{t("site.email")}
					</a>
					<p className="mt-5 max-w-[26em] text-pretty text-[0.95rem]">
						{t("booking.hours")}
					</p>
					<h3 className="sr-only">{t("booking.stepsLabel")}</h3>
					<ol className="mt-10 border-current border-b-2">
						{BOOKING_STEPS.map((step, index) => (
							<li
								key={step.id}
								className="grid grid-cols-[2.6rem_1fr] items-baseline gap-x-4 border-current border-t-2 py-4"
							>
								<span className="font-display text-[1.9rem] leading-none">
									{index + 1}
								</span>
								<span>
									<span className="block font-bold uppercase tracking-[0.04em]">
										{t(step.titleKey)}
									</span>
									<span className="block text-pretty text-[0.98rem]">
										{t(step.bodyKey)}
									</span>
								</span>
							</li>
						))}
					</ol>
				</div>
			</div>
		</section>
	);
}
