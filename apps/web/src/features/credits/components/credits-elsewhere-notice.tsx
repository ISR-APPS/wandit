/**
 * CreditsElsewhereNotice — "You have {balance} credits in {name}" block shown
 * above purchase content (plan picker, member billing notice) when the active
 * workspace's settled pool is drained but another workspace still has
 * credits. The switch button flips the app through the same switchWorkspace
 * path as the WorkspaceSwitcher, then closes the hosting dialog.
 */
import { PERSONAL_WORKSPACE } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { ArrowRightLeft } from "lucide-react";

import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
import { useTranslation } from "@/lib/i18n";
import { useWorkspaceCreditBalancesQuery } from "../api/credits.queries";
import { findCreditsElsewhere } from "../lib/credits-elsewhere";
import { formatCreditBalance } from "../lib/format-credits";

export function CreditsElsewhereNotice({
	onSwitched,
}: {
	/** Called after switching (dialog hosts close themselves here). */
	onSwitched?: () => void;
}) {
	const { locale, t } = useTranslation();
	const { activeWorkspaceId, switchWorkspace } = useWorkspace();
	const balancesQuery = useWorkspaceCreditBalancesQuery();
	const target = findCreditsElsewhere(
		activeWorkspaceId,
		balancesQuery.data?.items,
	);

	if (!target) {
		return null;
	}

	const targetName =
		target.workspaceId === PERSONAL_WORKSPACE
			? t("workspaces.switcher.personal")
			: (target.name ?? "");

	return (
		<div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-success/30 bg-success/[0.06] px-3 py-2.5">
			<p className="min-w-0 text-sm">
				{t("credits.elsewhere.dialogHint", {
					balance: formatCreditBalance(target.settledBalance, locale),
					name: targetName,
				})}
			</p>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={() => {
					switchWorkspace(target.workspaceId);
					onSwitched?.();
				}}
			>
				<ArrowRightLeft aria-hidden />
				{t("credits.elsewhere.switch")}
			</Button>
		</div>
	);
}
