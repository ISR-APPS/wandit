import { Button } from "@wandit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@wandit/ui/components/dialog";
import { useBillingModal } from "@/features/billing/components/billing-modal-provider";
import { usePurchasesEnabled } from "@/features/billing/lib/purchases";
import { useTranslation } from "@/lib/i18n";

type InsufficientCreditsDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function InsufficientCreditsDialog({
	open,
	onOpenChange,
}: InsufficientCreditsDialogProps) {
	const { t } = useTranslation();
	const { openPlanPicker } = useBillingModal();
	const purchasesEnabled = usePurchasesEnabled();
	const handleUpgrade = () => {
		onOpenChange(false);
		openPlanPicker("insufficient_credits");
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
				{/* No purchase CTA while all purchases are paused (beta). */}
				{purchasesEnabled !== false ? (
					<DialogFooter>
						<Button type="button" onClick={handleUpgrade} className="w-full">
							{t("credits.topUpDialog")}
						</Button>
					</DialogFooter>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
