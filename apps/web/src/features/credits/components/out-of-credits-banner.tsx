/**
 * The out-of-credits strip around a prompt composer.
 * The landing hero, the dashboard, and the chat panes of the two builders render it.
 * It reads the workspace, the purchase switch, the public settings, the balance, and the DZD rate.
 * It opens the top-up dialog and links to the /refer page.
 * A pool with no Starter pass gets the Starter pass copy; openTopup then opens the Starter pass dialog.
 */
import { Link } from "@tanstack/react-router";
import { STARTER_PASS_USD } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { Zap } from "lucide-react";
import type { ReactNode } from "react";

import {
	formatLocalPrice,
	useBillingModal,
	useDzdPerUsdRate,
	usePurchasesEnabled,
} from "@/features/billing";
import { usePublicSettingsQuery } from "@/features/settings";
import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
import { useTranslation } from "@/lib/i18n";
import { useOutOfCredits } from "../lib/out-of-credits";

/**
 * Out-of-credits treatment for composer surfaces: instead of a standalone
 * card, the PromptBox nests inside an ember halo with a one-line strip on
 * top — the same fused silhouette as the PromptBox beta banner, so the
 * blocked composer still reads as one component. Billing is owner-only
 * (teams-workspaces.md §9): org members get "ask an owner" copy instead of
 * the top-up CTA, and while purchases are paused the CTA disappears.
 * In a Personal workspace, while the referral program is on, the strip also
 * links to the /refer page, except in the Starter pass mode.
 *
 * Inactive, it renders children untouched — callers keep the wrapper mounted
 * and flip `active` (callers should also drop the beta banner while active,
 * or the composer stacks two strips).
 */
export function OutOfCreditsBanner({
	active,
	starterPassRequired,
	className,
	children,
}: {
	active: boolean;
	/**
	 * True shows the Starter pass copy. The V2 builder passes the state of the project payer.
	 * Undefined reads the balance of the active workspace pool.
	 */
	starterPassRequired?: boolean;
	className?: string;
	children: ReactNode;
}) {
	const { t } = useTranslation();
	const { actorCanManageBilling, isPersonal } = useWorkspace();
	const { openTopup } = useBillingModal();
	const purchasesEnabled = usePurchasesEnabled();
	const isUserReferralsEnabled =
		usePublicSettingsQuery().data?.userReferralsEnabled === true;
	const activePool = useOutOfCredits();

	if (!active) {
		return <>{children}</>;
	}

	const isStarterPass = starterPassRequired ?? activePool.starterPassRequired;
	const isBillingOwner = isPersonal || actorCanManageBilling;
	const canTopup = isBillingOwner && purchasesEnabled !== false;
	const detail = !isBillingOwner
		? t(
				isStarterPass
					? "credits.outOfCredits.starterPass.memberBody"
					: "credits.outOfCredits.memberBody",
			)
		: purchasesEnabled === false
			? t("credits.outOfCredits.pausedBody")
			: isStarterPass
				? t("credits.outOfCredits.starterPass.body")
				: null;
	// Product rule: referral rewards go to the personal pool, so an invite cannot fill a team pool.
	// Referral credits stay locked until the Starter pass, so the link is hidden in that mode.
	const showReferralLink =
		isUserReferralsEnabled && isPersonal && !isStarterPass;

	return (
		<div className={cn("rounded-[1.25rem] bg-primary/10 p-1 pt-0", className)}>
			<div
				role="status"
				className="flex min-h-9 items-center gap-2 py-1 ps-4 pe-1"
			>
				<Zap className="size-3.5 shrink-0 text-primary" aria-hidden />
				<p className="min-w-0 flex-1 text-xs">
					<span className="font-medium">
						{t(
							isStarterPass
								? "credits.outOfCredits.starterPass.title"
								: "credits.outOfCredits.title",
						)}
					</span>
					{detail ? (
						<span className="text-muted-foreground"> — {detail}</span>
					) : null}
					{/* The link is in the text, so it wraps with the text on a narrow composer. */}
					{showReferralLink ? (
						<>
							{/* The title has no full stop. Without a detail, the dash divides it from the link. */}
							{detail ? " " : " — "}
							<Link
								to="/refer"
								className="rounded-xs font-medium underline underline-offset-2 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50"
							>
								{t("userReferrals.entry.creditsLink")}
							</Link>
						</>
					) : null}
				</p>
				{canTopup ? (
					<Button
						type="button"
						size="sm"
						className="h-7 shrink-0 rounded-full px-3 text-xs"
						onClick={() => openTopup("out_of_credits")}
					>
						{isStarterPass ? (
							<StarterPassCtaLabel />
						) : (
							t("credits.outOfCredits.cta")
						)}
					</Button>
				) : null}
			</div>
			{children}
		</div>
	);
}

/**
 * Button label of the Starter pass mode, for example "Get the Starter pass — $1 / 250 DZD".
 * A separate component, so only the Starter pass mode loads the DZD rate.
 */
function StarterPassCtaLabel() {
	const { t, locale } = useTranslation();
	const dzdPerUsdRate = useDzdPerUsdRate();
	const usdPrice = formatLocalPrice(STARTER_PASS_USD, locale, null);
	const price =
		dzdPerUsdRate === null
			? usdPrice
			: `${usdPrice} / ${formatLocalPrice(STARTER_PASS_USD, locale, dzdPerUsdRate)}`;

	return t("credits.outOfCredits.starterPass.cta", { price });
}
