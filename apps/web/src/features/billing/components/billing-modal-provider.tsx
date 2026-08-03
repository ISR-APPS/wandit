import { useQueryClient } from "@tanstack/react-query";
import type { BillingInterval, CreditTier } from "@wandit/contracts";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

import { useAuthModal, useSession } from "@/features/auth";
import { creditsKeys } from "@/features/credits/api/credits.queries";
import {
	WorkspaceBillingNoticeDialog,
	type WorkspaceBillingNoticeKind,
} from "@/features/workspaces/components/workspace-billing-notice-dialog";
import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
import {
	type BillingErrorIntent,
	subscribeToBillingErrors,
	type UpgradeModalIntent,
} from "../lib/billing-error-dispatch";
import { PlanPickerDialog } from "./plan-picker-dialog";

type BillingModalContextValue = {
	openPlanPicker: (selection?: PlanPickerSelection) => void;
};

type PlanPickerSelection = {
	interval: BillingInterval;
	tierCredits: CreditTier;
};

const BillingModalContext = createContext<BillingModalContextValue | null>(
	null,
);

export function BillingModalProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();
	const { data: session } = useSession();
	const { open: openAuth } = useAuthModal();
	const { actorCanManageBilling, isPersonal } = useWorkspace();
	const [open, setOpen] = useState(false);
	const [intent, setIntent] = useState<UpgradeModalIntent | null>(null);
	const [selection, setSelection] = useState<PlanPickerSelection | null>(null);
	const [notice, setNotice] = useState<{
		kind: WorkspaceBillingNoticeKind;
		limitCredits?: number;
	} | null>(null);

	useEffect(
		() =>
			subscribeToBillingErrors((nextIntent: BillingErrorIntent) => {
				void queryClient.invalidateQueries({ queryKey: creditsKeys.all });

				// The plan picker cannot fix a member's monthly cap, and members
				// cannot fix an empty org pool — both get a notice instead
				// (teams-workspaces.md §9; billing is owner-only).
				if (nextIntent.code === "MEMBER_CREDIT_LIMIT_REACHED") {
					setNotice({
						kind: "memberLimit",
						limitCredits: nextIntent.limitCredits,
					});
					return;
				}

				if (!isPersonal && !actorCanManageBilling) {
					setNotice({ kind: "poolEmptyMember" });
					return;
				}

				setIntent(nextIntent);
				setSelection(null);
				setOpen(true);
			}),
		[actorCanManageBilling, isPersonal, queryClient],
	);

	const openPlanPicker = useCallback(
		(nextSelection?: PlanPickerSelection) => {
			if (!session) {
				openAuth({ next: "/billing" });
				return;
			}

			setIntent(null);
			setSelection(nextSelection ?? null);
			setOpen(true);
		},
		[openAuth, session],
	);

	const handleOpenChange = useCallback((nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) {
			setIntent(null);
			setSelection(null);
		}
	}, []);

	const value = useMemo(() => ({ openPlanPicker }), [openPlanPicker]);

	return (
		<BillingModalContext.Provider value={value}>
			{children}
			<PlanPickerDialog
				initialInterval={selection?.interval}
				initialTierCredits={selection?.tierCredits}
				open={open}
				onOpenChange={handleOpenChange}
				requiredCredits={intent?.requiredCredits}
				availableCredits={intent?.availableCredits}
			/>
			<WorkspaceBillingNoticeDialog
				kind={notice?.kind ?? "memberLimit"}
				limitCredits={notice?.limitCredits}
				open={notice !== null}
				onOpenChange={(nextOpen) => {
					if (!nextOpen) {
						setNotice(null);
					}
				}}
			/>
		</BillingModalContext.Provider>
	);
}

export function useBillingModal() {
	const context = useContext(BillingModalContext);
	if (!context) {
		throw new Error("useBillingModal must be used within BillingModalProvider");
	}

	return context;
}
