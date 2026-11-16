// One membership: the intention in italic serif, the plan name, the price, the points, and one button.
// MembershipsSection renders three. The featured tier is a clay card with a "Most chosen" flag and a bone button.
// Every button goes to the booking band (#begin): the page sells no plan online.
import type { TranslationKey } from "~/shared/i18n";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { BONE_BUTTON, GHOST_BUTTON } from "../lib/styles";

type TierCardProps = {
	/** Key of the sentence in quotes, for example "“I’m curious.”". */
	intentKey: TranslationKey;
	nameKey: TranslationKey;
	/** Key of the price number, in dollars, with no currency sign. */
	priceKey: TranslationKey;
	/** Key of "/ class" or "/ month". */
	perKey: TranslationKey;
	pointKeys: readonly TranslationKey[];
	ctaKey: TranslationKey;
	/** Key of the flag above the intention. Only the featured tier has one. */
	flagKey?: TranslationKey;
};

/** A tier card. With `flagKey` it is the featured clay card. */
export function TierCard({
	intentKey,
	nameKey,
	priceKey,
	perKey,
	pointKeys,
	ctaKey,
	flagKey,
}: TierCardProps) {
	const { t } = useT();
	const isFeatured = flagKey !== undefined;
	return (
		<article
			data-reveal
			data-featured={isFeatured}
			className={cn(
				"sp-tier flex flex-col rounded-2xl border p-[clamp(28px,3vw,42px)]",
				isFeatured
					? "border-transparent text-(--sp-bone)"
					: "border-(--sp-line) bg-background",
			)}
		>
			{flagKey === undefined ? null : (
				<p className="mb-[18px] self-start rounded-full border border-(--sp-bone)/50 px-3.5 py-1.5 font-bold font-sans text-[0.66rem] uppercase tracking-[0.26em]">
					{t(flagKey)}
				</p>
			)}
			<p className="font-display text-[clamp(1.5rem,2.1vw,1.9rem)] italic leading-[1.2]">
				{t(intentKey)}
			</p>
			<p
				className={cn(
					"mt-2.5 font-bold font-sans text-[0.72rem] uppercase tracking-[0.24em]",
					isFeatured ? "text-(--sp-bone)/85" : "text-primary",
				)}
			>
				{t(nameKey)}
			</p>
			<p className="mt-[26px] flex items-baseline gap-1.5 font-display text-[clamp(3rem,4.6vw,4.2rem)] leading-none">
				<span className="-translate-y-[1.1em] text-[0.45em]">
					{t("memberships.currency")}
				</span>
				<span className="tabular-nums">{t(priceKey)}</span>
				<span
					className={cn(
						"font-sans text-[0.9rem]",
						isFeatured ? "text-(--sp-bone)/75" : "text-(--sp-ink-64)",
					)}
				>
					{t(perKey)}
				</span>
			</p>
			<ul
				className={cn(
					"mt-[26px] mb-[34px] flex list-none flex-col gap-3 text-[0.95rem]",
					isFeatured ? "text-(--sp-bone)/90" : "text-(--sp-ink-78)",
				)}
			>
				{pointKeys.map((pointKey) => (
					<li key={pointKey} className="flex items-baseline gap-3">
						<span
							aria-hidden="true"
							className={cn(
								"size-[7px] shrink-0 -translate-y-px rounded-full",
								isFeatured ? "bg-(--sp-bone)" : "bg-(--sp-sage)",
							)}
						/>
						{t(pointKey)}
					</li>
				))}
			</ul>
			<a
				href="#begin"
				className={cn(isFeatured ? BONE_BUTTON : GHOST_BUTTON, "mt-auto")}
			>
				{t(ctaKey)}
			</a>
		</article>
	);
}
