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
	cost: number;
};

export function InsufficientCreditsDialog({
	open,
	onOpenChange,
	cost,
}: InsufficientCreditsDialogProps) {
	const { t } = useTranslation();
	const { openPlanPicker } = useBillingModal();
	const purchasesEnabled = usePurchasesEnabled();
	const handleUpgrade = () => {
		onOpenChange(false);
		openPlanPicker();
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
				<div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3">
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">
							{t("credits.costLabel")}
						</span>
						<span className="font-medium font-mono tabular-nums">{cost}</span>
					</div>
				</div>
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
