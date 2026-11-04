/**
 * Owns the plan picker and the workspace billing notice for the whole web app.
 * Listens to billing-error-dispatch.ts: a refusal opens the picker or a notice.
 * Components open the picker through useBillingModal().openPlanPicker.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import type {
	BillingInterval,
	BillingPlanId,
	CreditPayer,
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

/**
 * True when the plan picker can refill the pool that refused the turn.
 * A purchase credits the active workspace, so a refusal of any other pool gets the pool-empty notice.
 */
export function canBuyForPayer(input: {
	/** The pool that refused, from the 402 details. Undefined from an older API. */
	payer: CreditPayer | undefined;
	/** `personal` or the organization id of the active workspace. */
	activeWorkspaceId: string;
	/** True in the caller's own personal workspace. */
	isPersonal: boolean;
	/** True in the own personal workspace and for the owner of a team workspace. */
	actorCanManageBilling: boolean;
}): boolean {
	// An older API names no payer. Then the active workspace paid, as before.
	if (input.payer === undefined) {
		return input.actorCanManageBilling;
	}
	if (input.payer.kind === "user") {
		// Only the caller's own personal pool, bought from the own personal workspace.
		return input.payer.isActor && input.isPersonal;
	}
	return (
		input.payer.organizationId === input.activeWorkspaceId &&
		input.actorCanManageBilling
	);
}

export function BillingModalProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();
	const pathname = useLocation({ select: (location) => location.pathname });
	const { data: session } = useSession();
	const sessionUserId = session?.user.id;
	const { open: openAuth } = useAuthModal();
	const { actorCanManageBilling, activeWorkspaceId, isPersonal } =
		useWorkspace();
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
				// (teams-workspaces.md §9; billing is owner-only). The pool of a
				// shared project can also differ from the active workspace.
				if (nextIntent.code === "MEMBER_CREDIT_LIMIT_REACHED") {
					setNotice({
						kind: "memberLimit",
						limitCredits: nextIntent.limitCredits,
					});
					return;
				}

				if (
					!canBuyForPayer({
						payer: nextIntent.payer,
						activeWorkspaceId,
						isPersonal,
						actorCanManageBilling,
					})
				) {
					setNotice({ kind: "poolEmptyMember" });
					return;
				}

				setIntent(nextIntent);
				setSelection(null);
				setSurface("plan_picker");
				setOpen(true);
			}),
		[actorCanManageBilling, activeWorkspaceId, isPersonal, queryClient],
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
