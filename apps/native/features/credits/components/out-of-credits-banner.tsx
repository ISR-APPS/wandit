import { useTranslation } from "@wandit/internationalization/react";
import { useThemeColor } from "heroui-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { WanditIcon } from "@/components/wandit-icon";

import type { BillingErrorIntent } from "../lib/billing-error";
import { formatCreditAmount, formatCreditBalance } from "../lib/format-credits";
import { openBillingInBrowser } from "../lib/open-billing";

/**
 * Out-of-credits treatment for the composer (web parity with
 * out-of-credits-banner.tsx): the PromptBox nests inside an ember halo with a
 * one-line strip on top, so the blocked composer still reads as one
 * component. `active` is the balance-driven gate (shows the strip even before
 * any refusal, same signal that hard-locks the composer); `intent` carries a
 * refusal's detail — credit numbers or member-limit copy — when one happened.
 * With neither, it renders children untouched — callers keep the wrapper
 * mounted and flip the props. Billing is owner-only (teams-workspaces.md §9)
 * and web-only: the CTA opens the web app's /billing page in the system
 * browser. Native cannot read the workspace role or the purchases flag yet,
 * so both arrive as optional props that default to the owner shape —
 * personal workspaces are the mobile norm; wire real signals here once
 * native grows a workspace/settings query.
 */
export function OutOfCreditsBanner({
	active,
	intent,
	isBillingOwner = true,
	purchasesEnabled = true,
	children,
}: {
	active: boolean;
	intent: BillingErrorIntent | null;
	isBillingOwner?: boolean;
	purchasesEnabled?: boolean;
	children: ReactNode;
}) {
	const { locale, t } = useTranslation();
	const accent = useThemeColor("accent");

	if (!active && !intent) {
		return <>{children}</>;
	}

	const isMemberLimit = intent?.code === "MEMBER_CREDIT_LIMIT_REACHED";
	// Member-limit refusals are not fixable by buying credits (billing-error.ts),
	// so they suppress the CTA even for a billing owner.
	const canUpgrade =
		isBillingOwner && purchasesEnabled !== false && !isMemberLimit;
	const detail = !isBillingOwner
		? t("credits.outOfCredits.memberBody")
		: purchasesEnabled === false
			? t("credits.outOfCredits.pausedBody")
			: intent
				? isMemberLimit
					? t("native.workspace.chat.errors.memberLimit")
					: // Decimal credits: exact charge, floored balance (pricing v4).
						t("native.workspace.chat.errors.creditsDetails", {
							requiredCredits: formatCreditAmount(
								intent.requiredCredits,
								locale,
							),
							availableCredits: formatCreditBalance(
								intent.availableCredits,
								locale,
							),
						})
				: null;

	return (
		<View className="rounded-[22px] bg-accent/10 p-1">
			<View
				accessibilityRole="alert"
				className="min-h-9 flex-row items-center gap-2 py-1 ps-3.5 pe-1"
			>
				<WanditIcon name="spark" size={13} color={accent} />
				<Text className="min-w-0 flex-1 text-[12px] leading-[17px]">
					<Text className="font-sans-semibold text-foreground">
						{t("credits.outOfCredits.title")}
					</Text>
					{detail ? <Text className="text-muted"> — {detail}</Text> : null}
				</Text>
				{canUpgrade ? (
					<Pressable
						accessibilityRole="button"
						onPress={openBillingInBrowser}
						className="h-7 shrink-0 flex-row items-center justify-center rounded-full bg-foreground px-3 active:opacity-85"
					>
						<Text className="font-sans-semibold text-[12px] text-background">
							{t("credits.outOfCredits.cta")}
						</Text>
					</Pressable>
				) : null}
			</View>
			{children}
		</View>
	);
}
