// The agency window at the side of the register: the active home drawn large, with its facts and a mail link.
// RegisterSection renders it from 1024px up, sticky under the header. It reads one home of lib/listings.ts.
import { EnvelopeSimpleIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { districtOf } from "../lib/districts";
import { formatEuros } from "../lib/format";
import type { Listing } from "../lib/listings";
import { DISPLAY, FIGURES, LABEL } from "../lib/type-styles";
import { Facade } from "./facade";

type ShopWindowProps = {
	listing: Listing;
	/** Mail link with the reference in the subject, built by RegisterSection. */
	askHref: string;
};

/** Framed panel with crop marks. A new home re-mounts the drawing, so its pop entrance plays again. */
export function ShopWindow({ listing, askHref }: ShopWindowProps) {
	const { t, locale } = useT();
	const isSold = listing.status === "sold";

	return (
		<aside
			aria-label={t("register.windowTitle")}
			className="rn-corners sticky top-24 hidden border border-foreground bg-background lg:block"
		>
			<span aria-hidden="true" className="rn-corners-end" />
			<div
				className={cn(
					LABEL,
					"flex items-center justify-between border-foreground/12 border-b px-3.5 py-2.5 text-[10px] tracking-[0.2em]",
				)}
			>
				<span>{t("register.windowTitle")}</span>
				<span className={FIGURES} aria-live="polite">
					{listing.ref}
				</span>
			</div>
			<div className="bg-secondary/60 px-10 pt-5 pb-2">
				<Facade
					key={listing.ref}
					facade={listing.facade}
					label={t(listing.artKey)}
					className="rn-pop mx-auto block h-auto w-full max-w-60"
				/>
			</div>
			<div className="border-foreground/12 border-t px-3.5 pt-3 pb-4">
				<p className={cn(DISPLAY, "text-[26px] leading-none")}>
					{t(districtOf(listing.district).nameKey)}
				</p>
				<p
					className={cn(
						LABEL,
						FIGURES,
						"mt-1.5 text-[11px] leading-[1.7] tracking-[0.1em] opacity-70",
					)}
				>
					{t(listing.layoutKey)} ·{" "}
					<span className="normal-case">
						{listing.areaSqm} {t("site.squareMetres")}
					</span>
				</p>
				<p
					className={cn(
						DISPLAY,
						FIGURES,
						"mt-2 text-[34px] text-primary leading-none",
					)}
				>
					{formatEuros(listing.price, locale)}
				</p>
				{isSold ? (
					<p
						className={cn(
							LABEL,
							"mt-4 border-foreground/12 border-t pt-3 text-[10px] text-destructive",
						)}
					>
						{t("register.soldNote")}
					</p>
				) : (
					<a
						href={askHref}
						className={cn(
							LABEL,
							"mt-4 flex min-h-11 items-center justify-center gap-2 bg-primary px-4 text-[12px] text-primary-foreground transition-colors hover:bg-foreground hover:text-background",
						)}
					>
						<EnvelopeSimpleIcon className="size-4" />
						{t("register.askAbout")} {listing.ref}
					</a>
				)}
				<p className="mt-3 text-[12px] leading-snug opacity-60">
					{t("register.windowHint")}
				</p>
			</div>
		</aside>
	);
}
