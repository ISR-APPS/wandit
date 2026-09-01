import * as CountryFlags from "country-flag-icons/react/3x2";

import { cn } from "@/lib/utils";

const flagByCountryCode: Partial<Record<string, CountryFlags.FlagComponent>> = {
	...CountryFlags,
};

const englishCountryNames = new Intl.DisplayNames(["en"], {
	type: "region",
});

export function countryDisplayName(countryCode: string): string {
	try {
		return englishCountryNames.of(countryCode) ?? countryCode;
	} catch {
		return countryCode;
	}
}

type CountryFlagProps = {
	countryCode: string;
	className?: string;
	title?: string;
};

/**
 * SVG country flag with an ISO-letter fallback for codes without an asset.
 * Emoji flags are intentionally avoided because Windows renders them as text.
 */
export function CountryFlag({
	countryCode,
	className,
	title = countryDisplayName(countryCode),
}: CountryFlagProps) {
	const Flag = flagByCountryCode[countryCode];

	return (
		<span
			aria-hidden="true"
			dir="ltr"
			title={title}
			className={cn(
				"inline-flex h-3.5 w-[21px] shrink-0 items-center justify-center overflow-hidden rounded-[2px] bg-muted ring-1 ring-border",
				className,
			)}
		>
			{Flag ? (
				<Flag className="size-full" />
			) : (
				<span className="font-semibold text-[7px] text-muted-foreground tracking-wide">
					{countryCode}
				</span>
			)}
		</span>
	);
}
