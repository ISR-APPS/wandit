// Section 03, "the shutter": a full-bleed portrait photo that leaves the page on the start edge,
// three numbered steps on hairlines beside it, and the one logistics table of the page.
// LandingPage renders it on the paper ground. The ghost ticket calls the agency.
import { type TranslationKey, useT } from "~/shared/i18n";
import { PHOTOS } from "../lib/photos";
import {
	BODY,
	CAPTION,
	FIGURE,
	H2,
	META,
	META_SMALL,
} from "../lib/type-styles";
import { LockedPhoto } from "./locked-photo";
import { TicketLink } from "./ticket-link";

/** One step of the journey: the title and the text. The list position gives the number. */
type Step = {
	titleKey: TranslationKey;
	bodyKey: TranslationKey;
};

/** The three appointments before a departure, in order. */
const STEPS: readonly Step[] = [
	{ titleKey: "journey.step1Title", bodyKey: "journey.step1Body" },
	{ titleKey: "journey.step2Title", bodyKey: "journey.step2Body" },
	{ titleKey: "journey.step3Title", bodyKey: "journey.step3Body" },
];

/** One row of the logistics table: a label in capitals and a value in the display serif. */
type HourRow = {
	labelKey: TranslationKey;
	valueKey: TranslationKey;
};

/** The travel times of the three circuits on the page, the same as on their cards. The table appears once. */
const HOUR_ROWS: readonly HourRow[] = [
	{
		labelKey: "journey.southFlightLabel",
		valueKey: "journey.southFlightValue",
	},
	{ labelKey: "journey.eastFlightLabel", valueKey: "journey.eastFlightValue" },
	{ labelKey: "journey.roadLabel", valueKey: "journey.roadValue" },
	{ labelKey: "journey.guideLabel", valueKey: "journey.guideValue" },
];

/** The journey section. Two columns from 900px; on a phone the photo comes first at 340px to 440px high. */
export function JourneySection() {
	const { t } = useT();
	return (
		<section
			id="journey"
			aria-labelledby="journey-title"
			className="hz-journey bg-background"
		>
			<figure data-reveal className="hz-journey-photo">
				<LockedPhoto
					photo={PHOTOS.bridge}
					lock={{ k: 1.5, ty: -10.3 }}
					phoneLock={{ k: 1.75, ty: -14 }}
					alt={t("journey.photoAlt")}
					className="hz-journey-frame hz-wipe"
				/>
				<figcaption className={`${CAPTION} hz-journey-caption`}>
					{t("journey.photoCaption")}
				</figcaption>
			</figure>
			<div className="hz-journey-body">
				<div data-reveal className="hz-rise">
					<p className={`${META} mb-[18px] flex items-center gap-3`}>
						<span
							aria-hidden="true"
							className="size-[7px] shrink-0 bg-(--hz-sun)"
						/>
						{t("journey.label")}
					</p>
					<h2 id="journey-title" className={`${H2} text-balance`}>
						{t("journey.title")}
					</h2>
				</div>
				<ol className="mt-[34px]">
					{STEPS.map((step, index) => (
						<li
							key={step.titleKey}
							data-reveal
							className="hz-rise grid grid-cols-[clamp(2.4rem,3.6vw,3.2rem)_minmax(0,1fr)] gap-[clamp(18px,2.6vw,34px)] border-(--hz-hair) border-t py-[26px]"
						>
							<span
								aria-hidden="true"
								className={`${FIGURE} text-(--hz-sun-deep) text-[clamp(1.6rem,2.6vw,2.3rem)] tabular-nums leading-none`}
							>
								{String(index + 1).padStart(2, "0")}
							</span>
							<div>
								<h3 className="mb-2 font-display font-normal text-[clamp(1.2rem,1.7vw,1.5rem)] leading-[1.2]">
									{t(step.titleKey)}
								</h3>
								<p className={BODY}>{t(step.bodyKey)}</p>
							</div>
						</li>
					))}
				</ol>
				<div data-reveal className="hz-rise mt-[34px]">
					<p className={`${META_SMALL} mb-3`}>{t("journey.hoursLabel")}</p>
					<table className="w-full border-collapse">
						<tbody>
							{HOUR_ROWS.map((row) => (
								<tr key={row.labelKey} className="border-(--hz-hair) border-y">
									<th
										scope="row"
										className={`${META_SMALL} py-[11px] pe-4 text-start align-baseline`}
									>
										{t(row.labelKey)}
									</th>
									<td
										className={`${FIGURE} py-[11px] text-end align-baseline text-[1.06rem] tabular-nums`}
									>
										{t(row.valueKey)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<div data-reveal className="hz-rise mt-[34px]">
					<TicketLink
						href={t("site.phoneHref")}
						code={t("journey.callCode")}
						tone="ghost"
					>
						{t("journey.call")}
					</TicketLink>
				</div>
			</div>
		</section>
	);
}
