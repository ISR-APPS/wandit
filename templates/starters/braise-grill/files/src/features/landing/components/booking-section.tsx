// Section 06, a table: a guest quote and the coordinates, then a slate with the sittings and the call to book.
// LandingPage renders it last, before the footer. It posts no data: the actions are a tel: and a mailto: link.
// It reads BOOKING_COORDINATES and BOOKING_ROWS of lib/content.ts.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { BOOKING_COORDINATES, BOOKING_ROWS } from "../lib/content";
import {
	BUTTON,
	BUTTON_EMBER,
	BUTTON_GHOST,
	FIGURE,
	MICRO_LABEL,
	SECTION_TITLE,
} from "../lib/type-styles";
import { Eyebrow } from "./eyebrow";
import { FactList } from "./fact-list";

/** The booking. "Call to book" is the one ember action of the section. */
export function BookingSection() {
	const { t } = useT();
	return (
		<section
			id="book"
			aria-labelledby="book-title"
			className="br-section bg-background"
		>
			<div className="br-wrap br-booking__grid">
				<div>
					<Eyebrow className="mb-[clamp(14px,1.6vw,22px)]">
						{t("booking.eyebrow")}
					</Eyebrow>
					<h2
						id="book-title"
						className={cn(
							SECTION_TITLE,
							"mb-[clamp(22px,3vw,32px)] max-w-[15ch] text-[clamp(1.95rem,4vw,3.2rem)] leading-[1.02]",
						)}
					>
						{t("booking.title")}
					</h2>
					<figure data-reveal="rise">
						<span aria-hidden="true" className="br-uline" />
						<blockquote className="mt-[18px] max-w-[26ch] font-display font-medium text-[clamp(1.15rem,1.95vw,1.6rem)] leading-[1.25] tracking-[-0.022em]">
							<p>{t("booking.quote")}</p>
						</blockquote>
						<figcaption className={cn(MICRO_LABEL, "mt-4")}>
							{t("booking.quoteBy")}
						</figcaption>
					</figure>
					<FactList
						facts={BOOKING_COORDINATES}
						className="mt-[clamp(30px,4.5vh,52px)]"
						data-reveal="stagger"
					/>
				</div>

				<div className="br-slate br-slate--book" data-reveal="rise">
					<div aria-hidden="true" className="br-slate__heat" />
					<div className="relative z-[2]">
						<header className="flex flex-wrap items-baseline justify-between gap-x-3.5 gap-y-1">
							<h3 className="font-display font-semibold text-[clamp(1.25rem,1.9vw,1.7rem)] leading-tight tracking-[-0.02em]">
								{t("booking.slateTitle")}
							</h3>
							<p className={cn(MICRO_LABEL, "tracking-[0.14em]")}>
								{t("booking.slateMeta")}
							</p>
						</header>
						<span aria-hidden="true" className="br-slate__rule" />
						<ul>
							{BOOKING_ROWS.map((row) => (
								<li key={row.labelKey} className="br-dish">
									<span className="text-[clamp(13.5px,0.98vw,15.5px)] text-foreground/75 leading-[1.35]">
										{t(row.labelKey)}
									</span>
									<span aria-hidden="true" className="br-leader" />
									<span
										className={cn(
											FIGURE,
											"whitespace-nowrap font-semibold text-[clamp(13.5px,1vw,15.5px)] tracking-[-0.01em]",
										)}
									>
										{t(row.valueKey)}
									</span>
								</li>
							))}
						</ul>
						<p
							className={cn(
								FIGURE,
								"mt-[clamp(26px,3.4vw,40px)] font-bold text-[clamp(1.9rem,3.6vw,2.9rem)] leading-none tracking-[-0.035em]",
							)}
						>
							<a href={t("site.phoneHref")} className="br-link">
								{t("site.phoneDisplay")}
							</a>
						</p>
						<div className="mt-[clamp(20px,2.6vw,28px)] flex flex-wrap items-center gap-3">
							{/* No halo here: a halo would glow under the phone number, and the world bans glow on type. */}
							<a
								href={t("site.phoneHref")}
								className={cn(BUTTON, BUTTON_EMBER)}
							>
								{t("booking.call")}
							</a>
							<a
								href={t("site.emailHref")}
								className={cn(BUTTON, BUTTON_GHOST)}
							>
								{t("booking.write")}
							</a>
						</div>
						<p className="mt-[18px] max-w-[40ch] text-[13px] text-foreground/62 leading-[1.5]">
							{t("booking.callNote")}
						</p>
						<p className="mt-[clamp(22px,2.6vw,30px)] border-(--br-hair) border-t pt-4 text-[12.5px] text-foreground/55 leading-[1.5] tracking-[0.03em]">
							{t("booking.holdRule")}
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
