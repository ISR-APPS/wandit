// Workspace chrome: brand → dashboard, project switcher, autosave state,
// referral entry, credits, theme, publish state and account. Workspace tabs live in the main
// card's header (shell/main-pane-header.tsx), not here. The header is a 52px
// translucent parchment bar floating over the ambient horizon band that the
// page layout renders behind it (see pages/workspace-page.tsx).

import { GiftIcon } from "@phosphor-icons/react/Gift";
import { Link } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { GraduationCap, Zap } from "lucide-react";
import { useState } from "react";

import { Spark } from "@/components/logo";
import { UserMenu } from "@/features/auth";
import {
	useBillingModal,
	useBillingWalletQuery,
	usePurchasesEnabled,
} from "@/features/billing";
import { CreditsChip } from "@/features/credits";
import { FeedbackButton } from "@/features/feedback";
import {
	ReferralDialog,
	useUserReferralsEnabled,
} from "@/features/user-referrals";
import { useWorkspace } from "@/features/workspaces";
import { WorkspaceSwitcher } from "@/features/workspaces/components/workspace-switcher";
import { useTranslation } from "@/lib/i18n";
import { useSharedAiChat } from "../../lib/ai-chat-context";
import { ProjectSwitcher } from "./project-switcher";
import { PublishButton } from "./publish-button";

/** The top bar of the V1 project screen. It needs the shared AI chat context for the feedback button. */
export function WorkspaceHeader() {
	const { t } = useTranslation();
	const { chatId } = useSharedAiChat();
	return (
		<header className="relative z-40 flex h-[52px] shrink-0 items-center gap-[11px] border-b bg-background/72 px-4 backdrop-blur-sm">
			<Tooltip>
				<TooltipTrigger asChild>
					<Link
						to="/dashboard"
						aria-label={t("workspace.backToDashboard")}
						className="flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
					>
						<span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-gradient-ember">
							<Spark className="size-3.5 text-background" />
						</span>
						<span className="hidden font-semibold text-foreground text-lg tracking-[-0.5px] sm:block">
							wandit
						</span>
					</Link>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					{t("workspace.backToDashboard")}
				</TooltipContent>
			</Tooltip>
			<span aria-hidden className="mx-[5px] h-[18px] w-px bg-border" />
			<WorkspaceSwitcher className="hidden w-44 md:flex" />
			<ProjectSwitcher />

			<div className="ms-auto flex items-center gap-2.5">
				<span className="hidden items-center gap-[7px] text-[13px] text-muted-foreground md:flex">
					<span aria-hidden className="size-1.5 rounded-full bg-success" />
					{t("workspace.autosaved")}
				</span>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button asChild size="icon-sm" variant="ghost">
							<Link to="/academy" aria-label={t("academy.navLabel")}>
								<GraduationCap className="size-4" aria-hidden />
							</Link>
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">{t("academy.navLabel")}</TooltipContent>
				</Tooltip>
				<FeedbackButton chatId={chatId} />
				<ReferralEntry />
				<CreditsChip />
				<TopupButton />
				<PublishButton />
				<UserMenu />
			</div>
		</header>
	);
}

/** The "Earn free credits" button of the header. It opens the referral dialog and keeps the open state. */
function ReferralEntry() {
	const { t } = useTranslation();
	const isUserReferralsEnabled = useUserReferralsEnabled();
	const [isDialogOpen, setIsDialogOpen] = useState(false);

	// Product rule: the entry shows only while the admin switch of the referral program is on.
	if (!isUserReferralsEnabled) return null;

	return (
		<>
			<Button
				type="button"
				variant="ghost"
				aria-label={t("userReferrals.entry.button")}
				onClick={() => setIsDialogOpen(true)}
				// A spark pill, the same height as the upgrade button beside it.
				// A phone header has no room for it. The user menu has the same entry.
				className="hidden h-8 gap-1.5 rounded-full bg-spark/25 px-2.5 font-medium text-night hover:bg-spark/40 hover:text-night md:inline-flex xl:px-3.5 dark:bg-spark/15 dark:text-foreground dark:hover:bg-spark/25 dark:hover:text-foreground"
			>
				<GiftIcon weight="fill" className="size-4" aria-hidden />
				{/* Below 1280 px the header has no room for the text, so only the icon shows. */}
				<span className="hidden xl:inline">
					{t("userReferrals.entry.button")}
				</span>
			</Button>
			<ReferralDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
		</>
	);
}

/**
 * Compact "Top up" button next to Publish. Only a billing owner with no top-up yet sees it.
 * A paid owner tops up from the credits chip. app-sidebar.tsx holds the same rule.
 */
function TopupButton() {
	const { t } = useTranslation();
	const { openTopup } = useBillingModal();
	const { actorCanManageBilling, isPersonal } = useWorkspace();
	const purchasesEnabled = usePurchasesEnabled();
	const walletQuery = useBillingWalletQuery();
	// Wait for the wallet: a top-up call to action that flashes at a paying customer is worse than a late one.
	const visible =
		(isPersonal || actorCanManageBilling) &&
		purchasesEnabled !== false &&
		walletQuery.data?.isPaidOwner === false;

	if (!visible) {
		return null;
	}

	return (
		<Button
			type="button"
			size="sm"
			variant="secondary"
			className="h-8 px-3.5"
			onClick={() => openTopup("workspace_header")}
		>
			<Zap className="text-ember-text" aria-hidden />
			{t("workspace.topup")}
		</Button>
	);
}
