// The floating tableau of the hero: one paid invoice card and two satellite cards on a sky halo.
// HeroSection renders it. It is a drawing of the product, so a screen reader gets one sentence for all of it.
// landing.css plays the entrance of the three cards and the drift of the satellites.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { CHIP } from "../lib/class-names";

// The line items of the invoice. 25,200 + 8,400 + 5,700 = 39,300, and 19% of it is 7,467.
const INVOICE_LINES = [
	{ labelKey: "hero.line1Label", amountKey: "hero.line1Amount" },
	{ labelKey: "hero.line2Label", amountKey: "hero.line2Amount" },
	{ labelKey: "hero.line3Label", amountKey: "hero.line3Amount" },
	{ labelKey: "hero.vatLabel", amountKey: "hero.vatAmount" },
] as const;

// The six bars of the mini chart, as a share of the chart height. The last bar is the current month.
const CHART_BAR_HEIGHTS = [
	"h-[40%]",
	"h-[55%]",
	"h-[48%]",
	"h-[70%]",
	"h-[62%]",
	"h-[92%]",
];

/** On a phone the chart card is hidden, and the payment card overlaps the top of the invoice. */
export function HeroTableau() {
	const { t } = useT();
	return (
		<div
			role="img"
			aria-label={t("hero.tableauLabel")}
			className="relative mx-auto w-full max-w-[470px] lg:px-2.5 lg:pt-10 lg:pb-12"
		>
			<div
				aria-hidden="true"
				className="fw-halo pointer-events-none absolute -inset-x-5 -inset-y-[12%] lg:-inset-[38%]"
			/>

			<div className="fw-card fw-rise fw-sat-pay relative z-20 ms-auto -mb-4 w-[16.5rem] px-4 py-3.5 [--fw-order:4] lg:absolute lg:end-0 lg:-top-4 lg:mb-0 min-[90rem]:-end-7">
				<p className="flex items-center gap-2.5 font-bold font-display text-[0.86rem]">
					<span className="size-2.5 shrink-0 rounded-full bg-success" />
					{t("hero.paymentTitle")}
				</p>
				<p className="mt-1 text-[0.76rem] text-muted-foreground tabular-nums">
					{t("hero.paymentDetail")}
				</p>
			</div>

			<div className="fw-card fw-rise relative z-10 mx-auto max-w-[430px] px-6 pt-6 pb-5 [--fw-order:3]">
				<div className="flex items-center gap-3">
					<span className="font-bold font-display text-[0.92rem] tabular-nums">
						{t("hero.invoiceNumber")}
					</span>
					<span className={cn(CHIP, "bg-success/12 text-success")}>
						{t("hero.invoiceStatus")}
					</span>
				</div>
				<p className="mt-1.5 text-[0.85rem] text-muted-foreground">
					{t("hero.invoiceClient")}
				</p>
				<ul className="mt-4 grid gap-2.5 text-[0.86rem] tabular-nums">
					{INVOICE_LINES.map((line) => (
						<li key={line.labelKey} className="flex justify-between gap-3.5">
							<span>{t(line.labelKey)}</span>
							<span className="whitespace-nowrap font-semibold">
								{t(line.amountKey)}
							</span>
						</li>
					))}
				</ul>
				<div className="mt-4 flex items-baseline justify-between border-foreground/8 border-t pt-3 tabular-nums">
					<span className="font-bold font-display text-[0.9rem]">
						{t("hero.totalLabel")}
					</span>
					<span className="font-display font-extrabold text-[1.35rem]">
						{t("hero.totalAmount")}{" "}
						<span className="font-bold text-[0.62em] text-primary">
							{t("hero.currency")}
						</span>
					</span>
				</div>
				<p className="mt-2.5 text-end text-[0.76rem] text-muted-foreground tabular-nums">
					{t("hero.invoiceDates")}
				</p>
			</div>

			{/* On a phone the card is invisible, not removed: a change of display starts its entrance again. */}
			<div className="fw-card fw-rise fw-sat-chart invisible absolute start-0 bottom-0 z-20 w-[205px] px-4 py-3.5 [--fw-order:5] lg:visible lg:-start-9 lg:-bottom-10">
				<p className="font-bold font-display text-[0.8rem]">
					{t("hero.chartTitle")}
				</p>
				<div className="mt-2 flex h-11 items-end gap-1.5">
					{CHART_BAR_HEIGHTS.map((height, index) => (
						<span
							key={height}
							className={cn(
								"flex-1 rounded-t-[4px] rounded-b-[2px]",
								height,
								index === CHART_BAR_HEIGHTS.length - 1
									? "bg-primary"
									: "bg-(--fw-sky)",
							)}
						/>
					))}
				</div>
				<p className="mt-2 text-[0.74rem] text-muted-foreground tabular-nums">
					<b className="font-bold text-primary">{t("hero.chartDelta")}</b>{" "}
					{t("hero.chartCompare")}
				</p>
			</div>
		</div>
	);
}
