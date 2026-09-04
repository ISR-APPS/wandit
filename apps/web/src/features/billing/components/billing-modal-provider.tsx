import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import type {
	BillingInterval,
	BillingPlanId,
	CreditTier,
	ProductEventSurface,
} from "@wandit/contracts";
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
import type { PlanPickerPaymentMethod } from "../lib/billing-ui-policy";
import { landingPlanSelection } from "../lib/landing-plan-selection";
import { PlanPickerDialog } from "./plan-picker-dialog";

type BillingModalContextValue = {
	openPlanPicker: (
		surface: ProductEventSurface,
		selection?: PlanPickerSelection,
	) => void;
};

type PlanPickerSelection = {
	interval: BillingInterval;
	plan: BillingPlanId;
	tierCredits: CreditTier;
	paymentMethod?: PlanPickerPaymentMethod;
};

const BillingModalContext = createContext<BillingModalContextValue | null>(
	null,
);

export function BillingModalProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();
	const pathname = useLocation({ select: (location) => location.pathname });
	const { data: session } = useSession();
	const sessionUserId = session?.user.id;
	const { open: openAuth } = useAuthModal();
	const { actorCanManageBilling, isPersonal } = useWorkspace();
	const [open, setOpen] = useState(false);
	const [intent, setIntent] = useState<UpgradeModalIntent | null>(null);
	const [selection, setSelection] = useState<PlanPickerSelection | null>(null);
	const [surface, setSurface] = useState<ProductEventSurface>("plan_picker");
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
				setSurface("plan_picker");
				setOpen(true);
			}),
		[actorCanManageBilling, isPersonal, queryClient],
	);

	useEffect(() => {
		// In-place sign-in from the landing page performs a full navigation to
		// /billing. Leave the one-shot value intact until that destination mounts.
		if (!sessionUserId || pathname !== "/billing") return;

		const pendingSelection = landingPlanSelection.consume();
		if (!pendingSelection) return;

		setIntent(null);
		setSelection(pendingSelection);
		setSurface("marketing_pricing");
		setOpen(true);
	}, [pathname, sessionUserId]);

	const openPlanPicker = useCallback(
		(nextSurface: ProductEventSurface, nextSelection?: PlanPickerSelection) => {
			if (!sessionUserId) {
				if (nextSurface === "marketing_pricing" && nextSelection) {
					landingPlanSelection.stash(nextSelection);
				}
				openAuth({ next: "/billing" });
				return;
			}

			setIntent(null);
			setSelection(nextSelection ?? null);
			setSurface(nextSurface);
			setOpen(true);
		},
		[openAuth, sessionUserId],
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
				initialPlan={selection?.plan}
				initialTierCredits={selection?.tierCredits}
				initialPaymentMethod={selection?.paymentMethod}
				open={open}
				onOpenChange={handleOpenChange}
				surface={surface}
				requiredCredits={intent?.requiredCredits}
				availableCredits={intent?.availableCredits}
				heldCredits={intent?.heldCredits}
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
