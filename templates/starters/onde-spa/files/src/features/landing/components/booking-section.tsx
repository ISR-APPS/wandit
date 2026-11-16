// The booking: the questions of the telephone call as a short ruled list, and one call action.
// Beside it, the plate of practical facts and the warm stones photo. LandingPage renders it last, before the footer.
// The page has no form: a starter cannot ship the table that a public form needs. STARTER.md says where it goes.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { PHOTOS } from "../lib/photos";
import {
	BODY_TEXT,
	LABEL,
	PRIMARY_BUTTON,
	SECTION_TITLE,
	SECTION_Y,
	WRAP,
} from "../lib/styles";
import { GradedPhoto } from "./graded-photo";
import { PebbleDivider } from "./pebble-divider";
import { SteamVeil } from "./steam-veil";

/** The small tracked label of a ruled line or a fact of the plate. */
const FIELD_LABEL =
	"font-sans text-[0.73rem] text-primary lowercase tracking-[0.18em]";

/** The <section id="book"> that every booking button opens. */
export function BookingSection() {
	const { t } = useT();
	const asks = [
		{ label: t("booking.ask1Label"), value: t("booking.ask1Value") },
		{ label: t("booking.ask2Label"), value: t("booking.ask2Value") },
		{ label: t("booking.ask3Label"), value: t("booking.ask3Value") },
		{ label: t("booking.ask4Label"), value: t("booking.ask4Value") },
		{ label: t("booking.ask5Label"), value: t("booking.ask5Value") },
	];
	return (
		<section
			id="book"
			aria-labelledby="book-title"
			className={cn("relative bg-background", SECTION_Y)}
		>
			<SteamVeil kind="seam" phase={5} />
			<div
				className={cn(
					WRAP,
					"relative z-3 grid grid-cols-1 items-stretch gap-[clamp(2.5rem,5vh,3.5rem)] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:gap-[clamp(2rem,4.4vw,4.6rem)]",
				)}
			>
				<div>
					<div data-reveal="">
						<p className={LABEL}>{t("booking.label")}</p>
						<h2 id="book-title" className={cn(SECTION_TITLE, "mt-4")}>
							{t("booking.title")}
						</h2>
						<p className="mt-[1.1rem] max-w-[46ch] text-(--onde-ink-72) text-[clamp(1.02rem,1.18vw,1.2rem)] leading-[1.68]">
							{t("booking.lead")}
						</p>
					</div>
					<div data-reveal="" className="mt-[clamp(2.2rem,4.8vh,3.2rem)]">
						<h3 className="font-display font-normal text-[1.2rem] leading-[1.3]">
							{t("booking.askLabel")}
						</h3>
						{/* A read-only list on 16% hairlines: the label beside its answer, so no line looks like an input. */}
						<dl className="m-0 mt-[clamp(0.8rem,1.8vh,1.2rem)] divide-y divide-(--onde-hair)">
							{asks.map((ask) => (
								<div
									key={ask.label}
									className="grid grid-cols-1 items-baseline gap-x-6 gap-y-1 py-[0.85rem] sm:grid-cols-[10.5rem_minmax(0,1fr)]"
								>
									<dt className={FIELD_LABEL}>{ask.label}</dt>
									<dd className="m-0 font-display text-(--onde-ink-72) text-[1.05rem] leading-[1.45]">
										{ask.value}
									</dd>
								</div>
							))}
						</dl>
						<div className="mt-[clamp(1.8rem,3.6vh,2.6rem)] flex flex-wrap items-center gap-x-[1.2rem] gap-y-3">
							<a
								href={t("site.phoneHref")}
								aria-label={t("site.phoneAria")}
								className={PRIMARY_BUTTON}
							>
								{t("booking.callCta")}
							</a>
							<small className="max-w-[34ch] text-(--onde-ink-66) text-[0.78rem]">
								{t("booking.callNote")}
							</small>
						</div>
					</div>
					<div
						data-reveal=""
						className="mt-[clamp(2.4rem,5vh,3.4rem)] border-(--onde-hair) border-t pt-[clamp(1.4rem,3vh,2rem)]"
					>
						<p className={FIELD_LABEL}>{t("booking.firstVisitLabel")}</p>
						<p className="mt-3 max-w-[30ch] text-balance font-display text-[clamp(1.35rem,1.9vw,1.75rem)] leading-[1.3]">
							{t("booking.firstVisitBody")}
						</p>
					</div>
				</div>
				<div className="flex flex-col">
					<div
						data-reveal=""
						className="rounded-lg border border-(--onde-hair) bg-(--onde-plate) p-[clamp(1.5rem,2.4vw,2.2rem)]"
					>
						<dl className="m-0 grid gap-[1.35rem]">
							<div>
								<dt className={FIELD_LABEL}>{t("booking.addressLabel")}</dt>
								<dd className="m-0 mt-1.5 text-[0.95rem] leading-[1.6]">
									{t("booking.addressLine1")}
									<br />
									{t("booking.addressLine2")}
								</dd>
							</div>
							<div>
								<dt className={FIELD_LABEL}>{t("booking.hoursLabel")}</dt>
								<dd className="m-0 mt-1.5 text-[0.95rem] leading-[1.6]">
									{t("booking.hoursWomen")}
									<br />
									{t("booking.hoursMen")}
								</dd>
							</div>
							<div>
								<dt className={FIELD_LABEL}>{t("booking.phoneLabel")}</dt>
								<dd className="m-0 mt-1 text-[0.95rem] leading-[1.6]">
									<a
										href={t("site.phoneHref")}
										aria-label={t("site.phoneAria")}
										className="inline-flex min-h-11 items-center tabular-nums no-underline"
									>
										<span className="border-(--onde-hair-strong) border-b transition-colors duration-[350ms] ease-(--onde-tide) hover:border-(--onde-sage)">
											{t("site.phoneDisplay")}
										</span>
									</a>
								</dd>
							</div>
						</dl>
						<PebbleDivider phase={3} className="my-[1.6rem]" />
						<p className={cn(BODY_TEXT, "m-0 text-[0.87rem]")}>
							{t("booking.infoNote")}
						</p>
					</div>
					{/* The photo fills the height that the plate leaves, so the column never ends on bare ground. */}
					<GradedPhoto
						photo={PHOTOS.warmStones}
						alt={t("booking.stonesAlt")}
						maskClassName="min-h-[clamp(220px,30vh,320px)] flex-1 rounded-lg"
						imageClassName="object-[48%_66%]"
						note={t("booking.stonesCaption")}
						className="mt-[clamp(1.4rem,3vh,2.2rem)] flex flex-1 flex-col"
					/>
				</div>
			</div>
		</section>
	);
}
