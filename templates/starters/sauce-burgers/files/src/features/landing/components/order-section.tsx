// The closing section on the hot ground: how to order ahead by telephone, beside the cream plate with the address and the hours.
// LandingPage renders it last in <main>. It posts no data: its actions are a tel: link and a mailto: link.
// STARTER.md says where a real order form goes.
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	BUTTON,
	BUTTON_GHOST,
	BUTTON_MUSTARD,
	DISPLAY_TEXT,
	LABEL_TEXT,
	PHONE_FULL_WIDTH,
	TITLE_LEADING,
	WRAP,
} from "../lib/type-styles";
import { DripEdge } from "./drip-edge";
import { SectionEyebrow } from "./section-eyebrow";

// The four things that the counter asks on the telephone, in the order of the call.
// Each line pairs the question with a sample answer that the visitor can say.
const SCRIPT_LINES: readonly {
	labelKey: TranslationKey;
	valueKey: TranslationKey;
}[] = [
	{ labelKey: "order.slipNameLabel", valueKey: "order.slipNameValue" },
	{ labelKey: "order.slipTimeLabel", valueKey: "order.slipTimeValue" },
	{ labelKey: "order.slipModeLabel", valueKey: "order.slipModeValue" },
	{ labelKey: "order.slipOrderLabel", valueKey: "order.slipOrderValue" },
];

const HOURS: readonly { labelKey: TranslationKey; valueKey: TranslationKey }[] =
	[
		{ labelKey: "order.hoursWeekLabel", valueKey: "order.hoursWeekValue" },
		{ labelKey: "order.hoursFridayLabel", valueKey: "order.hoursFridayValue" },
		{
			labelKey: "order.hoursSaturdayLabel",
			valueKey: "order.hoursSaturdayValue",
		},
	];

const PLATE_TERM_CLASS = cn(
	LABEL_TEXT,
	"pt-0.75 text-foreground/65 tracking-[0.1em]",
);
// The padding makes the link 44px high for a finger. The negative margin keeps the row height.
const PLATE_LINK_CLASS =
	"-my-2.5 inline-block py-2.5 hover:text-primary focus-visible:text-primary";
const PLATE_LINK_LINE_CLASS = "border-primary border-b-2";

/** Two columns from 1024px. The plate keeps its own height, so no empty band opens inside it. */
export function OrderSection() {
	const { t } = useT();
	return (
		<section
			id="order"
			className="sc-on-hot relative scroll-mt-15 bg-primary py-(--sc-pad) text-primary-foreground"
		>
			<DripEdge variant="c" tone="cream" />
			<div
				className={cn(
					WRAP,
					"grid items-start gap-[clamp(30px,4vw,64px)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.78fr)]",
				)}
			>
				<div data-flick="l">
					<SectionEyebrow label={t("order.eyebrow")} ground="hot" />
					<h2
						className={cn(
							DISPLAY_TEXT,
							"text-[clamp(2.3rem,5.6vw,4rem)]",
							TITLE_LEADING,
						)}
					>
						{t("order.titleLine1")}
						<br />
						{t("order.titleLine2")}
					</h2>
					<p className="mt-3.5 max-w-[40ch] text-[clamp(1.02rem,1.35vw,1.28rem)]">
						{t("order.lede")}
					</p>
					<h3
						className={cn(
							DISPLAY_TEXT,
							"mt-[clamp(22px,3.4vh,36px)] mb-3.5 text-(--sc-mustard-on-hot) text-[clamp(1.5rem,2vw,1.6rem)] leading-none",
						)}
					>
						{t("order.slipHead")}
					</h3>
					{/* A quoted script in one dashed block, not a set of fields: nothing here looks like an input. */}
					<ol className="grid gap-y-3 border-2 border-primary-foreground/50 border-dashed p-[clamp(16px,2vw,24px)]">
						{SCRIPT_LINES.map((line, index) => (
							<li
								key={line.labelKey}
								className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3.5"
							>
								<span
									aria-hidden="true"
									className={cn(
										DISPLAY_TEXT,
										"w-[1ch] text-[1.5rem] text-primary-foreground/60 leading-none",
									)}
								>
									{index + 1}
								</span>
								<p>
									<span className={cn(LABEL_TEXT, "me-2.5 tracking-[0.12em]")}>
										{t(line.labelKey)}
									</span>
									<q
										className={cn(
											DISPLAY_TEXT,
											"text-[clamp(1.15rem,1.6vw,1.35rem)] leading-[1.1]",
										)}
									>
										{t(line.valueKey)}
									</q>
								</p>
							</li>
						))}
					</ol>
					<div className="mt-[clamp(20px,3vh,30px)] flex flex-wrap items-center gap-x-4 gap-y-3">
						<a
							href={t("site.phoneHref")}
							className={cn(BUTTON, BUTTON_MUSTARD, PHONE_FULL_WIDTH)}
						>
							{t("site.callVerb")} · {t("site.phoneDisplay")}
						</a>
						<a
							href={t("site.emailHref")}
							className={cn(
								BUTTON,
								BUTTON_GHOST,
								PHONE_FULL_WIDTH,
								"border-(--sc-mustard) hover:bg-background hover:text-foreground focus-visible:bg-background focus-visible:text-foreground",
							)}
						>
							{t("order.writeToUs")}
						</a>
					</div>
					<p className="mt-4 max-w-[46ch] font-semibold text-[0.86rem]">
						{t("order.note")}
					</p>
				</div>
				<div
					data-flick="r"
					className="flex flex-col bg-background p-[clamp(20px,2.6vw,30px)] text-foreground"
				>
					<h3
						className={cn(
							DISPLAY_TEXT,
							"mb-3.5 text-[clamp(1.3rem,2.2vw,1.8rem)] leading-none",
						)}
					>
						{t("order.findUs")}
					</h3>
					<dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-2.5 text-[0.94rem]">
						<dt className={PLATE_TERM_CLASS}>{t("order.addressLabel")}</dt>
						<dd className="font-semibold">
							{t("order.addressLine1")}
							<br />
							{t("order.addressLine2")}
						</dd>
						<dt className={PLATE_TERM_CLASS}>{t("order.phoneLabel")}</dt>
						<dd className="font-semibold">
							<a href={t("site.phoneHref")} className={PLATE_LINK_CLASS}>
								<span className={PLATE_LINK_LINE_CLASS}>
									{t("site.phoneDisplay")}
								</span>
							</a>
						</dd>
						<dt className={PLATE_TERM_CLASS}>{t("order.emailLabel")}</dt>
						<dd className="font-semibold">
							<a href={t("site.emailHref")} className={PLATE_LINK_CLASS}>
								<span className={cn(PLATE_LINK_LINE_CLASS, "break-all")}>
									{t("site.email")}
								</span>
							</a>
						</dd>
						<dt className={PLATE_TERM_CLASS}>{t("order.accessLabel")}</dt>
						<dd className="font-semibold">{t("order.accessValue")}</dd>
						<dt className={PLATE_TERM_CLASS}>{t("order.parkingLabel")}</dt>
						<dd className="font-semibold">{t("order.parkingValue")}</dd>
						<dt className={PLATE_TERM_CLASS}>{t("order.deliveryLabel")}</dt>
						<dd className="font-semibold">{t("order.deliveryValue")}</dd>
						<dt className={PLATE_TERM_CLASS}>{t("order.paymentLabel")}</dt>
						<dd className="font-semibold">{t("order.paymentValue")}</dd>
					</dl>
					<p className="mt-4.5 mb-5 bg-(--sc-mustard) px-3.25 py-2.75 font-semibold text-[0.86rem]">
						{t("order.driveNote")}
					</p>
					<dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3.5 gap-y-1.5 border-foreground border-t-[3px] pt-3.5">
						{HOURS.map((row) => (
							<div key={row.labelKey} className="contents">
								<dt className={PLATE_TERM_CLASS}>{t(row.labelKey)}</dt>
								<dd
									className={cn(
										DISPLAY_TEXT,
										"text-end text-[clamp(1.2rem,1.8vw,1.5rem)] leading-none",
									)}
								>
									{t(row.valueKey)}
								</dd>
							</div>
						))}
					</dl>
				</div>
			</div>
		</section>
	);
}
