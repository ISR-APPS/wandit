// One price carton of the packages section: a mount-white card with a 1px gold border.
// PackagesSection renders three of them. The chosen package is lifted, gets the double hairline, and a rose flag on its top edge.
// The price is in the display face. The currency is a small rose suffix, raised like an exponent.
import type { CSSProperties } from "react";
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { H3, TEXT_LINK, TEXT_LINK_RULE } from "../lib/type-styles";

/** The texts of one package, as keys of the `packages` group of messages.ts. */
export type PackageOffer = {
	/** "Package I", "Package II", or "Package III". */
	numberKey: TranslationKey;
	nameKey: TranslationKey;
	/** The amount with its thousands separator, with no currency. */
	priceKey: TranslationKey;
	/** The lines of the list, in order. */
	itemKeys: readonly TranslationKey[];
	/** True for the one package that most couples pick. */
	isChosen: boolean;
};

type PackageCartonProps = {
	offer: PackageOffer;
	/** Inline style of the reveal stagger. */
	style: CSSProperties;
};

/** The carton. Its link scrolls to the reply card. */
export function PackageCarton({ offer, style }: PackageCartonProps) {
	const { t } = useT();
	return (
		<article
			data-reveal="lift"
			style={style}
			className={cn(
				"relative flex flex-col bg-card px-[clamp(22px,2.4vw,34px)] py-[clamp(28px,3vw,44px)]",
				offer.isChosen
					? "voeu-double-rule min-[900px]:-mt-[clamp(18px,2.4vw,34px)] min-[900px]:pt-[clamp(34px,3.6vw,54px)]"
					: "border border-(--voeu-gold-line)",
			)}
		>
			{offer.isChosen ? (
				<p className="absolute start-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-(--voeu-liner) px-[14px] font-bold text-(--voeu-rose-deep) text-[10px] uppercase leading-[1.6] tracking-[0.19em] rtl:translate-x-1/2">
					{t("packages.chosenFlag")}
				</p>
			) : null}
			<p className="mb-3 font-bold text-[10.5px] text-foreground/68 uppercase tracking-[0.17em]">
				{t(offer.numberKey)}
			</p>
			<h3 className={H3}>{t(offer.nameKey)}</h3>
			<p className="mt-5 font-display text-[clamp(1.8rem,2.9vw,2.55rem)] leading-none">
				{t(offer.priceKey)}
				<span className="ms-2 align-[0.55em] font-bold font-sans text-(--voeu-rose-deep) text-[12px] tracking-[0.15em]">
					{t("packages.currency")}
				</span>
			</p>
			<ul className="mt-6 flex-1 border-(--voeu-hair) border-t">
				{offer.itemKeys.map((itemKey) => (
					<li
						key={itemKey}
						className="border-(--voeu-hair) border-b py-3 text-[0.93rem] text-foreground/78 leading-[1.6]"
					>
						{t(itemKey)}
					</li>
				))}
			</ul>
			<a href="#reply" className={`${TEXT_LINK} mt-5 self-start`}>
				<span className={TEXT_LINK_RULE}>{t("packages.ask")}</span>
			</a>
		</article>
	);
}
