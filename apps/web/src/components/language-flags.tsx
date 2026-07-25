import { cn } from "@wandit/ui/lib/utils";
import { type ReactElement, useId } from "react";

import type { Locale } from "@/lib/i18n";

/**
 * Crisp inline-SVG flag badges for the supported locales. Emoji flags are
 * avoided because Windows renders them as bare letters; these are self-contained
 * vector paths (no deps, no external images). Each flag is designed to sit
 * inside a round, circle-cropped badge (see {@link LocaleFlag}) and is marked
 * `aria-hidden` — the adjacent text labels carry the meaning.
 */

// `aria-hidden` is set literally on each <svg> (not via this spread) so static
// a11y linters can see it — these flags are decorative; text labels carry meaning.
const svgProps = {
	focusable: false,
	className: "size-full",
	preserveAspectRatio: "xMidYMid slice" as const,
};

/** United Kingdom — Union Jack (canonical simplified counterchange). */
function UnitedKingdomFlag(): ReactElement {
	const raw = useId();
	const clipId = `uk-${raw.replace(/:/g, "")}`;

	return (
		<svg viewBox="0 0 60 30" aria-hidden="true" {...svgProps}>
			<clipPath id={clipId}>
				<path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
			</clipPath>
			<path d="M0,0 v30 h60 v-30 z" fill="#012169" />
			<path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth={6} />
			<path
				d="M0,0 L60,30 M60,0 L0,30"
				clipPath={`url(#${clipId})`}
				stroke="#C8102E"
				strokeWidth={4}
			/>
			<path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth={10} />
			<path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth={6} />
		</svg>
	);
}

/** France — three equal vertical bands (bleu, blanc, rouge). */
function FranceFlag(): ReactElement {
	return (
		<svg viewBox="0 0 60 60" aria-hidden="true" {...svgProps}>
			<rect x="0" width="20" height="60" fill="#0055A4" />
			<rect x="20" width="20" height="60" fill="#FFFFFF" />
			<rect x="40" width="20" height="60" fill="#EF4135" />
		</svg>
	);
}

/**
 * Arabic — deliberately NOT a flag: the language spans two dozen countries,
 * so tying it to any one of them is wrong. The badge is the letter ʿayn (ع),
 * the conventional country-neutral mark for Arabic. currentColor keeps it
 * legible in both themes.
 */
function ArabicBadge(): ReactElement {
	return (
		<svg viewBox="0 0 60 60" aria-hidden="true" {...svgProps}>
			<rect width="60" height="60" fill="currentColor" opacity={0.08} />
			<text
				x="30"
				y="32"
				textAnchor="middle"
				dominantBaseline="central"
				fontSize="34"
				fontWeight="600"
				fill="currentColor"
			>
				ع
			</text>
		</svg>
	);
}

const FLAGS: Record<Locale, () => ReactElement> = {
	en: UnitedKingdomFlag,
	fr: FranceFlag,
	ar: ArabicBadge,
};

/**
 * Round, circle-cropped flag badge for a locale. Defaults to `size-4.5`; pass
 * `className` (e.g. `size-5`) to override — it wins via tailwind-merge. The SVG
 * covers the circle fully; a subtle border-token ring rims the badge.
 */
export function LocaleFlag({
	locale,
	className,
}: {
	locale: Locale;
	className?: string;
}) {
	const Flag = FLAGS[locale];

	return (
		<span
			className={cn(
				"inline-flex aspect-square size-4.5 shrink-0 overflow-hidden rounded-full ring-1 ring-border",
				className,
			)}
		>
			<Flag />
		</span>
	);
}
