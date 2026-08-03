import { useQuery } from "@tanstack/react-query";

import { creditsKeys } from "./credits.keys";
import { getCreditBalance } from "./credits.requests";

/** Authenticated balance shared by the home chip and project sheet. */
export function useCreditBalance() {
	return useQuery({
		queryKey: creditsKeys.balance(),
		queryFn: getCreditBalance,
	});
}
