import { dialCountries } from "@wandit/contracts";
import { CircleHelpIcon } from "lucide-react";
import type { ComponentType } from "react";

import type { DataTableFacetedFilterOption } from "@/components/data-table";
import type { UserCountryFilter } from "@/features/users/api/users.dto";
import {
	CountryFlag,
	countryDisplayName,
} from "@/features/users/components/country-flag";

type CountryFilterOption = DataTableFacetedFilterOption & {
	value: UserCountryFilter[number];
};

function countryFlagIcon(
	countryCode: string,
): ComponentType<{ className?: string }> {
	return function CountryFilterFlagIcon() {
		return <CountryFlag countryCode={countryCode} />;
	};
}

const countryOptions = Array.from(
	new Map(dialCountries.map((country) => [country.iso, country])).values(),
)
	.map<CountryFilterOption>((country) => ({
		label: countryDisplayName(country.iso),
		value: country.iso,
		icon: countryFlagIcon(country.iso),
	}))
	.sort((a, b) => a.label.localeCompare(b.label, "en"));

export const USER_COUNTRY_FILTER_OPTIONS: readonly CountryFilterOption[] = [
	{
		label: "Unknown",
		value: "unknown",
		icon: CircleHelpIcon,
	},
	...countryOptions,
];
