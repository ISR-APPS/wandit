import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import {
	BillingReturnShell,
	DashboardButton,
} from "@/features/billing/components/billing-return-shell";
import { getBillingReturnCopy } from "@/features/billing/lib/billing-return-copy";
import { creditsKeys } from "@/features/credits/api/credits.queries";
import { useTranslation } from "@/lib/i18n";

export default function BillingCancelPage() {
	const { locale } = useTranslation();
	const copy = getBillingReturnCopy(locale);
	const queryClient = useQueryClient();

	useEffect(() => {
		void queryClient.invalidateQueries({ queryKey: creditsKeys.balance() });
		void queryClient.invalidateQueries({ queryKey: creditsKeys.activities() });
	}, [queryClient]);

	return (
		<BillingReturnShell
			tone="warning"
			title={copy.cancel.title}
			body={copy.cancel.body}
			actions={<DashboardButton label={copy.backToDashboard} />}
		/>
	);
}
