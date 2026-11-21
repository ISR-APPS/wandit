/**
 * The "Not enough credits" dialog. A prompt box opens it when an action costs more than the balance.
 * The landing hero, the dashboard, and the template page render it.
 * It opens the top-up dialog through useBillingModal and links to the /refer page.
 * A pool with no Starter pass gets the Starter pass copy; openTopup then opens the Starter pass dialog.
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
import { useOutOfCredits } from "../lib/out-of-credits";

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
	// The create flows refetch the balance after a 402, so a Starter pass refusal shows this copy too.
	const { starterPassRequired } = useOutOfCredits();
	// Product rule: referral rewards go to the personal pool, so an invite cannot fill a team pool.
	// Referral credits stay locked until the Starter pass, so the link is hidden in that mode.
	const showReferralLink =
		usePublicSettingsQuery().data?.userReferralsEnabled === true &&
		isPersonal &&
		!starterPassRequired;
	const handleTopup = () => {
		onOpenChange(false);
		openTopup("insufficient_credits");
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-sm" closeLabel={t("common.close")}>
				<DialogHeader>
					<DialogTitle className="font-display font-semibold tracking-tight">
						{t(
							starterPassRequired
								? "credits.starterPassTitle"
								: "credits.insufficientTitle",
						)}
					</DialogTitle>
					<DialogDescription>
						{t(
							starterPassRequired
								? "credits.starterPassBody"
								: "credits.insufficientBody",
						)}
					</DialogDescription>
				</DialogHeader>
				{/* No purchase CTA while all purchases are paused. */}
				{purchasesEnabled !== false ? (
					<DialogFooter>
						<Button type="button" onClick={handleTopup} className="w-full">
							{t(
								starterPassRequired
									? "credits.starterPassCta"
									: "credits.topUpDialog",
							)}
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
