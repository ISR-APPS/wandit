/**
 * The "Not enough credits" dialog. A prompt box opens it when an action costs more than the balance.
 * The landing hero, the dashboard, and the template page render it.
 * It opens the top-up dialog through useBillingModal and links to the /refer page.
 */
import { Link } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@wandit/ui/components/dialog";
import { useBillingModal, usePurchasesEnabled } from "@/features/billing";
import { usePublicSettingsQuery } from "@/features/settings";
import { useWorkspace } from "@/features/workspaces";
import { useTranslation } from "@/lib/i18n";

type InsufficientCreditsDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** The parent owns `open`. The dialog closes itself before it opens the top-up dialog or goes to /refer. */
export function InsufficientCreditsDialog({
	open,
	onOpenChange,
}: InsufficientCreditsDialogProps) {
	const { t } = useTranslation();
	const { openTopup } = useBillingModal();
	const purchasesEnabled = usePurchasesEnabled();
	const { isPersonal } = useWorkspace();
	// Product rule: referral rewards go to the personal pool, so an invite cannot fill a team pool.
	const showReferralLink =
		usePublicSettingsQuery().data?.userReferralsEnabled === true && isPersonal;
	const handleTopup = () => {
		onOpenChange(false);
		openTopup("insufficient_credits");
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-sm" closeLabel={t("common.close")}>
				<DialogHeader>
					<DialogTitle className="font-display font-semibold tracking-tight">
						{t("credits.insufficientTitle")}
					</DialogTitle>
					<DialogDescription>{t("credits.insufficientBody")}</DialogDescription>
				</DialogHeader>
				{/* No purchase CTA while all purchases are paused. */}
				{purchasesEnabled !== false ? (
					<DialogFooter>
						<Button type="button" onClick={handleTopup} className="w-full">
							{t("credits.topUpDialog")}
						</Button>
					</DialogFooter>
				) : null}
				{showReferralLink ? (
					<Link
						to="/refer"
						// The dialog closes on the way out, as it does before the top-up dialog opens.
						onClick={() => onOpenChange(false)}
						className="justify-self-center rounded-xs font-medium text-sm underline underline-offset-2 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50"
					>
						{t("userReferrals.entry.creditsLink")}
					</Link>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
