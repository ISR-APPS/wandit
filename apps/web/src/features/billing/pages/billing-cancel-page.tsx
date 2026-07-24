import {
	BillingReturnShell,
	DashboardButton,
} from "@/features/billing/components/billing-return-shell";
import { getBillingReturnCopy } from "@/features/billing/lib/billing-return-copy";
import { useTranslation } from "@/lib/i18n";

export default function BillingCancelPage() {
	const { locale } = useTranslation();
	const copy = getBillingReturnCopy(locale);

	return (
		<BillingReturnShell
			tone="warning"
			title={copy.cancel.title}
			body={copy.cancel.body}
			actions={<DashboardButton label={copy.backToDashboard} />}
		/>
	);
}
