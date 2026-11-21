/**
 * Owns the top-up dialog and the workspace billing notice for the whole web app.
 * Listens to billing-error-dispatch.ts: a refusal opens the top-up dialog or a notice.
 * Components open the dialog through useBillingModal().openTopup. The dialog sells the Starter pass while the wallet needs it.
 */
import { useQueryClient } from "@tanstack/react-query";
import type { CreditPayer, ProductEventSurface } from "@wandit/contracts";
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
import { billingKeys } from "../api/billing.queries";
import {
	type BillingErrorIntent,
	subscribeToBillingErrors,
	type UpgradeModalIntent,
} from "../lib/billing-error-dispatch";
import { TopupDialog } from "./topup-dialog";

type BillingModalContextValue = {
	/**
	 * Opens the top-up dialog for the active workspace wallet. A signed-out visitor gets the auth modal.
	 * `amountUsd` is whole USD to select at open. The dialog ignores it while the wallet needs the Starter pass.
	 */
	openTopup: (surface: ProductEventSurface, amountUsd?: number) => void;
};

const BillingModalContext = createContext<BillingModalContextValue | null>(
	null,
);

/**
 * True when the top-up dialog can refill the pool that refused the turn.
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

/**
 * Mounted once in routes/__root.tsx. A signed-out openTopup opens the auth modal.
 * A 402 for a pool that the user cannot pay for shows a notice, not the dialog.
 */
export function BillingModalProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();
	const { data: session } = useSession();
	const sessionUserId = session?.user.id;
	const { open: openAuth } = useAuthModal();
	const { actorCanManageBilling, activeWorkspaceId, isPersonal } =
		useWorkspace();
	const [open, setOpen] = useState(false);
	const [intent, setIntent] = useState<UpgradeModalIntent | null>(null);
	const [amountUsd, setAmountUsd] = useState<number | undefined>(undefined);
	const [surface, setSurface] = useState<ProductEventSurface>("plan_picker");
	const [notice, setNotice] = useState<{
		kind: WorkspaceBillingNoticeKind;
		limitCredits?: number;
	} | null>(null);
	const [askOwnerForStarterPass, setAskOwnerForStarterPass] = useState(false);

	useEffect(
		() =>
			subscribeToBillingErrors((nextIntent: BillingErrorIntent) => {
				void queryClient.invalidateQueries({ queryKey: creditsKeys.all });
				const isStarterPassRefusal =
					nextIntent.code !== "MEMBER_CREDIT_LIMIT_REACHED" &&
					nextIntent.reason === "starter_pass_required";

				// A top-up cannot fix a member's monthly cap, and members
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

				const canBuy = canBuyForPayer({
					payer: nextIntent.payer,
					activeWorkspaceId,
					isPersonal,
					actorCanManageBilling,
				});

				// The pool has credits but no Starter pass. "Pool empty" is not true, so the dialog asks for the owner.
				if (!canBuy && isStarterPassRefusal) {
					setIntent(null);
					setAskOwnerForStarterPass(true);
					setOpen(true);
					return;
				}

				if (!canBuy) {
					setNotice({ kind: "poolEmptyMember" });
					return;
				}

				const openDialog = () => {
					setIntent(nextIntent);
					setAmountUsd(undefined);
					setAskOwnerForStarterPass(false);
					// A 402 opens the dialog from no named screen. "plan_picker" is the analytics value of the dialog itself.
					// The value stays: it is in the shared surface enum, and old funnel reports use it.
					setSurface("plan_picker");
					setOpen(true);
				};

				// The dialog picks the Starter pass mode from the wallet. A cached wallet can be from before the switch.
				// So the dialog opens after a fresh wallet. A failed reload still opens it, with the cached wallet.
				if (isStarterPassRefusal) {
					void queryClient
						.refetchQueries({ queryKey: billingKeys.wallet() })
						.finally(openDialog);
					return;
				}

				openDialog();
			}),
		[actorCanManageBilling, activeWorkspaceId, isPersonal, queryClient],
	);

	const openTopup = useCallback(
		(nextSurface: ProductEventSurface, nextAmountUsd?: number) => {
			if (!sessionUserId) {
				openAuth({ next: "/billing" });
				return;
			}

			setIntent(null);
			setAmountUsd(nextAmountUsd);
			setAskOwnerForStarterPass(false);
			setSurface(nextSurface);
			setOpen(true);
		},
		[openAuth, sessionUserId],
	);

	const handleOpenChange = useCallback((nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) {
			setIntent(null);
			setAmountUsd(undefined);
			setAskOwnerForStarterPass(false);
		}
	}, []);

	const value = useMemo(() => ({ openTopup }), [openTopup]);

	return (
		<BillingModalContext.Provider value={value}>
			{children}
			<TopupDialog
				initialAmountUsd={amountUsd}
				open={open}
				onOpenChange={handleOpenChange}
				surface={surface}
				requiredCredits={intent?.requiredCredits}
				availableCredits={intent?.availableCredits}
				heldCredits={intent?.heldCredits}
				askOwnerForStarterPass={askOwnerForStarterPass}
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

/** Gives `openTopup`. Throws outside BillingModalProvider, which __root.tsx mounts around the app. */
export function useBillingModal() {
	const context = useContext(BillingModalContext);
	if (!context) {
		throw new Error("useBillingModal must be used within BillingModalProvider");
	}

	return context;
}
