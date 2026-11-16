// One home of the register: reference, drawn facade, district and street, layout, and price.
// RegisterSection renders one per visible home. A pointer, a focus, or a tap puts the home in ShopWindow.
// Under 1024px the window is hidden, so the active row opens a strip with a call link and an email link.
import { EnvelopeSimpleIcon, PhoneIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { districtOf } from "../lib/districts";
import { formatEuros } from "../lib/format";
import { type Listing, pricePerSqm, STATUS_STAMP_KEYS } from "../lib/listings";
import { DISPLAY, FIGURES, LABEL } from "../lib/type-styles";
import { Facade } from "./facade";
import { Stamp } from "./stamp";

type ListingRowProps = {
	listing: Listing;
	/** True when this home is the one in the window. */
	isActive: boolean;
	/** Puts this home in the window. Receives the reference of the home. */
	onSelect: (ref: string) => void;
	/** Mail link with the reference in the subject. RegisterSection builds it once for the row and the window. */
	askHref: string;
};

/** A ruled row. Five columns on a wide screen; facade, text, and price on a phone. */
export function ListingRow({
	listing,
	isActive,
	onSelect,
	askHref,
}: ListingRowProps) {
	const { t, locale } = useT();
	const district = t(districtOf(listing.district).nameKey);
	const isSold = listing.status === "sold";

	return (
		<li className="relative border-foreground/12 border-t last:border-b">
			<button
				type="button"
				data-active={isActive}
				data-status={listing.status}
				aria-pressed={isActive}
				onMouseEnter={() => onSelect(listing.ref)}
				onFocus={() => onSelect(listing.ref)}
				onClick={() => onSelect(listing.ref)}
				className={cn(
					"rn-row relative grid w-full grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 px-0.5 py-3 text-start transition-colors hover:bg-secondary sm:grid-cols-[86px_72px_minmax(0,1.15fr)_minmax(0,1fr)_minmax(150px,236px)] sm:gap-4.5 sm:px-1 sm:py-3.5",
					isActive && "bg-secondary",
				)}
			>
				<span
					className={cn(
						LABEL,
						FIGURES,
						"hidden text-[12px] tracking-[0.1em] sm:block",
					)}
				>
					{listing.ref}
					<small className="mt-1 block font-normal text-[10px] tracking-[0.08em] opacity-60">
						{t(listing.postedKey)}
					</small>
				</span>
				<Facade
					facade={listing.facade}
					className="row-span-2 h-17.5 w-14 self-start sm:row-span-1 sm:h-22 sm:w-18"
				/>
				<span className="min-w-0">
					<span
						className={cn(
							DISPLAY,
							"block text-[clamp(21px,1.9vw,26px)] leading-[0.92]",
						)}
					>
						{district}
					</span>
					<span className="block text-[12px] leading-normal opacity-70">
						{t(listing.streetKey)}
					</span>
				</span>
				<span
					className={cn(
						LABEL,
						"col-start-2 row-start-2 text-[11px] leading-[1.6] tracking-[0.06em] sm:col-start-auto sm:row-start-auto sm:text-[12px] sm:leading-[1.9]",
					)}
				>
					{t(listing.layoutKey)}
					<span className="block font-normal opacity-60">
						<span className="normal-case">
							{listing.areaSqm} {t("site.squareMetres")}
						</span>{" "}
						· {t(listing.featureKey)}
					</span>
				</span>
				<span className="rn-price-cell row-span-2 self-center text-end sm:row-span-1">
					{listing.previousPrice !== undefined && (
						<s
							className={cn(
								FIGURES,
								"block text-[13px] leading-snug opacity-55",
							)}
						>
							<span className="sr-only">{t("register.wasPrice")} </span>
							{formatEuros(listing.previousPrice, locale)}
						</s>
					)}
					<span
						className={cn(
							DISPLAY,
							FIGURES,
							"block text-[19px] text-primary leading-none tracking-[0.01em] sm:text-[clamp(24px,2.2vw,31px)]",
						)}
					>
						{formatEuros(listing.price, locale)}
					</span>
					<small
						className={cn(
							LABEL,
							FIGURES,
							"hidden text-[10px] normal-case tracking-[0.1em] opacity-60 sm:block",
						)}
					>
						{isSold
							? t("register.soldNote")
							: `${formatEuros(pricePerSqm(listing), locale)} ${t("register.perSqm")}`}
					</small>
					{/* The stamp sits in the price cell, so it never covers the layout text of the row. */}
					{isSold && (
						<Stamp
							tone="destructive"
							className="rn-sold-stamp rn-slam mt-1.5 px-2.5 py-1.5 text-[13px] [--rn-tilt:-10deg] sm:text-[16px]"
						>
							{t(STATUS_STAMP_KEYS.sold)}
						</Stamp>
					)}
				</span>
				{listing.status !== "listed" && (
					<span className="sr-only">
						{t(STATUS_STAMP_KEYS[listing.status])}
					</span>
				)}
			</button>
			{(listing.status === "new" || listing.status === "price-cut") && (
				<Stamp className="rn-slam pointer-events-none absolute end-2 -top-2.75 z-2 bg-background px-1.75 pt-1.25 pb-1 text-[10px] sm:start-37.5 sm:end-auto">
					{t(STATUS_STAMP_KEYS[listing.status])}
				</Stamp>
			)}
			{isActive && !isSold && (
				<div className="flex flex-wrap gap-2 ps-17.5 pb-3 lg:hidden">
					<a
						href={t("site.phoneHref")}
						className={cn(
							LABEL,
							"inline-flex min-h-11 items-center gap-2 bg-primary px-3.5 text-[11px] text-primary-foreground",
						)}
					>
						<PhoneIcon className="size-4" />
						{t("site.callAbout")}
					</a>
					<a
						href={askHref}
						className={cn(
							LABEL,
							"inline-flex min-h-11 items-center gap-2 border border-foreground px-3.5 text-[11px]",
						)}
					>
						<EnvelopeSimpleIcon className="size-4" />
						{t("register.askAbout")} {listing.ref}
					</a>
				</div>
			)}
		</li>
	);
}
