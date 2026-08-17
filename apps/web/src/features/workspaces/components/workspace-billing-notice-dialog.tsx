/**
 * Workspace billing refusals that the plan picker cannot fix
 * (teams-workspaces.md §9):
 * - a member hit their monthly credit cap (403) — an owner/admin must raise it;
 * - the shared pool ran dry and the viewer cannot manage billing — an owner
 *   must add credits.
 */
import { Button } from "@wandit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@wandit/ui/components/dialog";

import { formatCreditAmount } from "@/features/credits/lib/format-credits";
import { useTranslation } from "@/lib/i18n";

export type WorkspaceBillingNoticeKind = "memberLimit" | "poolEmptyMember";

export function WorkspaceBillingNoticeDialog({
	kind,
	limitCredits,
	open,
	onOpenChange,
}: {
	kind: WorkspaceBillingNoticeKind;
	limitCredits?: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { locale, t } = useTranslation();
	const title =
		kind === "memberLimit"
			? t("workspaces.errors.memberLimitTitle")
			: t("workspaces.errors.poolEmptyTitle");
	const body =
		kind === "memberLimit"
			? t("workspaces.errors.memberLimitBody", {
					limit: formatCreditAmount(limitCredits ?? 0, locale),
				})
			: t("workspaces.errors.poolEmptyBodyMember");

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader className="text-start">
					<DialogTitle className="font-display tracking-tight">
						{title}
					</DialogTitle>
					<DialogDescription>{body}</DialogDescription>
				</DialogHeader>
				<Button type="button" onClick={() => onOpenChange(false)}>
					{t("workspaces.errors.memberLimitCta")}
				</Button>
			</DialogContent>
		</Dialog>
	);
}
