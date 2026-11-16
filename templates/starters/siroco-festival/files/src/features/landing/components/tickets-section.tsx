// The prices: the three passes as display numerals, split by 2px rules. No chip, no box, no badge.
// LandingPage renders it on mustard. A giant "*" points to the one honest footnote under the prices.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { PASSES } from "../lib/content";
import {
	BUTTON,
	LABEL,
	SHEET_PAD,
	SUB_DISPLAY,
	WRAP,
} from "../lib/type-styles";

/** Entrance delay steps of the three price columns. Static class names, so Tailwind finds them. */
const STAGGER = ["", "[--sf-i:1]", "[--sf-i:2]"];

/**
 * From 1024px the price list stops 20rem before the viewport end edge.
 * The asterisk is sized from the viewport height, so it then owns clear ground beside the prices.
 */
export function TicketsSection() {
	const { t } = useT();
	return (
		<section
			id="tickets"
			aria-labelledby="tickets-title"
			className="sf-mustard relative overflow-clip"
		>
			<p
				aria-hidden="true"
				data-slab=""
				data-watch="parent"
				data-from="end"
				className="sf-glyph absolute -end-[0.12em] -bottom-[0.3em] font-display text-[clamp(22rem,60vw,26rem)] lg:-bottom-[0.12em] lg:text-[clamp(30rem,80vh,50rem)]"
			>
				*
			</p>
			<div
				className={cn(
					WRAP,
					SHEET_PAD,
					"relative pb-[clamp(13rem,40vw,16rem)] lg:pb-[clamp(7rem,16vh,10rem)]",
				)}
			>
				<div data-slab="">
					<p className={LABEL}>{t("tickets.label")}</p>
					<h2 id="tickets-title" className={cn(SUB_DISPLAY, "mt-5 mb-12")}>
						{t("tickets.title")}
					</h2>
				</div>
				<ul className="grid max-w-270 md:grid-cols-3 lg:max-w-[min(67.5rem,calc(100vw-20rem))]">
					{PASSES.map((pass, index) => (
						<li
							key={pass.id}
							data-slab=""
							className={cn(
								"flex flex-col items-start py-7 md:py-0 md:ps-[clamp(1.25rem,2.4vw,2.2rem)] md:pe-[clamp(1rem,2vw,2rem)]",
								index > 0 &&
									"border-current border-t-2 md:border-s-2 md:border-t-0",
								index === 0 && "pt-0 md:ps-0",
								STAGGER[index],
							)}
						>
							<h3 className="font-bold font-sans text-base uppercase tracking-[0.06em]">
								{t(pass.nameKey)}
							</h3>
							<p className="mt-3 font-display text-[clamp(3.6rem,6.5vw,5.6rem)] tabular-nums leading-none">
								<span className="me-0.5 align-[0.62em] text-[0.42em] tracking-[0.02em]">
									{t("site.currency")}
								</span>
								{pass.priceEuros}
							</p>
							<ul className="mt-5 mb-7 flex flex-col gap-2 text-pretty text-[0.98rem]">
								{pass.lineKeys.map((lineKey) => (
									<li key={lineKey}>{t(lineKey)}</li>
								))}
							</ul>
							<a
								href="#book"
								className={cn(BUTTON, "mt-auto px-[1.7em] text-[0.8rem]")}
							>
								{t(pass.actionKey)}
							</a>
						</li>
					))}
				</ul>
				<p
					data-slab=""
					className="mt-12 max-w-[34em] text-pretty border-current border-t-2 pt-5 font-semibold"
				>
					{t("tickets.footnote")}
				</p>
			</div>
		</section>
	);
}
