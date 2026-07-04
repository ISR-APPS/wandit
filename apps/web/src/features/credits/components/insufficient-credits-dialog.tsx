import { Button } from "@wandit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@wandit/ui/components/dialog";

import { useTranslation } from "@/lib/i18n";
import { useCredits } from "../lib/hooks";

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
	const { balance } = useCredits();

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
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">
							{t("credits.balanceRowLabel")}
						</span>
						<span className="font-medium font-mono text-destructive tabular-nums">
							{balance}
						</span>
					</div>
				</div>
				<DialogFooter>
					<Button type="button" disabled className="w-full">
						{t("credits.topUpDialog")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
