// The first screen: today's board. A tag line, the three-line title in ruled rows, the count of homes,
// and the listing ticker at the floor of the screen. LandingPage renders it.
// It reads the homes of lib/listings.ts for the ticker and the count of lib/districts.ts.
import { ArrowDownIcon } from "@phosphor-icons/react";
import { Fragment } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { districtOf, HOMES_AT_AGENCY } from "../lib/districts";
import { formatCount, formatEuros } from "../lib/format";
import { LISTINGS, STATUS_STAMP_KEYS } from "../lib/listings";
import { DISPLAY, FIGURES, LABEL, WRAP } from "../lib/type-styles";
import { Marquee } from "./marquee";
import { Stamp } from "./stamp";
import { TodayLabel } from "./today-label";

/** Fills the screen under the header, so the ticker sits on the fold. */
export function HeroSection() {
	const { t, locale } = useT();
	const titleLines = [t("hero.line1"), t("hero.line2"), t("hero.line3")];

	return (
		<section
			id="top"
			aria-labelledby="hero-title"
			// The hero fills the screen, but never more than the title needs plus 340px, so a wide short screen keeps no empty band.
			className="flex min-h-[min(calc(100svh_-_var(--rn-header)),calc(34vw_+_340px))] flex-col"
		>
			<div
				className={cn(
					WRAP,
					LABEL,
					"rn-hero-fade flex flex-wrap items-baseline justify-between gap-x-7 gap-y-2 pt-4 pb-2.5",
				)}
			>
				<p className="flex items-center gap-2">
					<span aria-hidden="true" className="inline-block size-2 bg-primary" />
					<span>
						<TodayLabel />{" "}
						<span className="whitespace-nowrap">— {t("hero.updated")}</span>
					</span>
				</p>
				<p className="hidden sm:block">{t("hero.label")}</p>
				<p className={FIGURES}>{t("hero.posting")}</p>
			</div>

			<h1
				id="hero-title"
				className={cn(
					DISPLAY,
					"text-[clamp(56px,11vw,176px)] leading-[0.94] max-sm:text-[17.5vw]",
				)}
			>
				{titleLines.map((line, index) => (
					<span
						key={line}
						className={cn(
							WRAP,
							"rn-line block overflow-hidden border-foreground/12 border-t pt-[0.07em] pb-[0.02em]",
						)}
					>
						<span className="rn-line-inner">
							{line}
							{index === titleLines.length - 1 && (
								<Stamp className="rn-hero-stamp ms-[clamp(16px,4vw,64px)] hidden px-2.5 py-1.5 align-middle text-[clamp(11px,1.3vw,18px)] tracking-[0.2em] [--rn-tilt:-4deg] sm:inline-block">
									{t("hero.stamp")}
								</Stamp>
							)}
						</span>
					</span>
				))}
			</h1>

			<div
				className={cn(
					WRAP,
					"rn-hero-fade grid items-end gap-x-(--rn-pad) gap-y-6 border-foreground/12 border-t pt-5.5 pb-6.5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]",
				)}
			>
				<div>
					<p className="max-w-[56ch] text-[15px] leading-relaxed sm:text-base">
						{t("hero.introStart")}
						<strong className="font-bold">{t("hero.introStrong")}</strong>
						{t("hero.introEnd")}
					</p>
					<a
						href="#register"
						className={cn(
							LABEL,
							"mt-3.5 inline-flex min-h-11 items-center gap-2 border-primary border-b-2 text-[12px] text-primary transition-colors hover:border-foreground hover:text-foreground",
						)}
					>
						{t("hero.cta")}
						<ArrowDownIcon className="size-3.5" />
					</a>
				</div>
				<p className="flex items-end gap-4 md:flex-col md:items-end md:gap-1 md:text-end">
					<span
						className={cn(
							DISPLAY,
							FIGURES,
							"text-[clamp(84px,9vw,132px)] leading-[0.82]",
						)}
					>
						{formatCount(HOMES_AT_AGENCY, locale)}
					</span>
					<span className={cn(LABEL, "flex items-center gap-2 pb-1.5")}>
						<span
							aria-hidden="true"
							className="inline-block size-2 bg-primary"
						/>
						{t("hero.countLabel")}
					</span>
				</p>
			</div>

			<Marquee className="mt-auto border-foreground/12 border-y">
				{LISTINGS.map((listing) => (
					<Fragment key={listing.ref}>
						<span
							className={cn(
								LABEL,
								FIGURES,
								"inline-flex items-center gap-3.5 py-3.25 text-[13px] leading-none tracking-[0.08em]",
							)}
						>
							{listing.status !== "listed" && (
								<span
									className={cn(
										"-rotate-4 border-2 border-current px-1.5 pt-1 pb-0.75 text-[10px] tracking-[0.14em]",
										listing.status === "sold"
											? "text-destructive"
											: "text-primary",
									)}
								>
									{t(STATUS_STAMP_KEYS[listing.status])}
								</span>
							)}
							<span>
								{listing.ref} · {t(districtOf(listing.district).nameKey)} ·{" "}
								<span className="normal-case">
									{listing.areaSqm} {t("site.squareMetres")}
								</span>
							</span>
							{listing.status === "sold" ? (
								<span className="opacity-60">— {t("ticker.soldIn")}</span>
							) : (
								<span className="text-primary">
									{formatEuros(listing.price, locale)}
								</span>
							)}
						</span>
						<span
							aria-hidden="true"
							className="mx-5.5 inline-block size-2 shrink-0 bg-primary"
						/>
					</Fragment>
				))}
			</Marquee>
		</section>
	);
}
