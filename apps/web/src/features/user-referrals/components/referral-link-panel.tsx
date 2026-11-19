/**
 * The invite link of the signed-in user, with the copy button and the share row.
 * The /refer page and the referral dialog render it. It reads the summary query for the code
 * and the public settings for the bonus in the share text. It sends the copy and share events to PostHog.
 */
import type { Icon } from "@phosphor-icons/react";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/ArrowClockwise";
import { CopySimpleIcon } from "@phosphor-icons/react/CopySimple";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/EnvelopeSimple";
import { FacebookLogoIcon } from "@phosphor-icons/react/FacebookLogo";
import { ShareNetworkIcon } from "@phosphor-icons/react/ShareNetwork";
import { WhatsappLogoIcon } from "@phosphor-icons/react/WhatsappLogo";
import { XLogoIcon } from "@phosphor-icons/react/XLogo";
import { captureEvent } from "@wandit/analytics/browser";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import { useUserReferralSummaryQuery } from "../api/user-referrals.queries";
import {
	buildInviteUrl,
	buildShareUrl,
	copyToClipboard,
	type ShareContent,
	type ShareTarget,
} from "../lib/helpers";
import { useCreditPhrase, useUserReferralRewards } from "../lib/hooks";

type ReferralLinkPanelProps = {
	/** Where the panel shows. It goes to PostHog as the `surface` of each event. */
	surface: "page" | "dialog";
	className?: string;
};

/** The share targets with a brand name. A brand name has no translation. */
const BRAND_SHARE_TARGETS = [
	{ target: "whatsapp", name: "WhatsApp", TargetIcon: WhatsappLogoIcon },
	{ target: "x", name: "X", TargetIcon: XLogoIcon },
	{ target: "facebook", name: "Facebook", TargetIcon: FacebookLogoIcon },
] as const satisfies readonly {
	target: ShareTarget;
	name: string;
	TargetIcon: Icon;
}[];

// One share target: a pill with an icon and a name. On a phone it is a 40 px circle, and the name stays for screen readers.
const SHARE_PILL_CLASS =
	"inline-flex h-10 items-center justify-center gap-2 rounded-full bg-night/[0.05] px-3.5 font-grotesk font-medium text-[13px] text-night outline-offset-2 transition-colors hover:bg-night/[0.1] focus-visible:outline-2 focus-visible:outline-ember max-sm:size-10 max-sm:px-0 dark:bg-white/[0.07] dark:text-foreground dark:hover:bg-white/[0.12]";

const SHARE_NAME_CLASS = "max-sm:sr-only";

/** The link row and the share row. It shows bars while the code loads, and a retry row after a failure. */
export function ReferralLinkPanel({
	surface,
	className,
}: ReferralLinkPanelProps) {
	const { t } = useTranslation();
	const creditPhrase = useCreditPhrase();
	const rewards = useUserReferralRewards();
	const summaryQuery = useUserReferralSummaryQuery();

	if (summaryQuery.isError) {
		return (
			<div
				role="alert"
				className={cn(
					"flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-destructive/[0.06] px-4 py-3",
					className,
				)}
			>
				<p className="font-grotesk font-semibold text-night text-sm dark:text-foreground">
					{t("userReferrals.link.loadError")}
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="rounded-full font-grotesk"
					// The lock stops a second request while the first one runs.
					disabled={summaryQuery.isFetching}
					onClick={() => void summaryQuery.refetch()}
				>
					<ArrowClockwiseIcon
						aria-hidden
						weight="bold"
						className={cn(
							"size-4",
							summaryQuery.isFetching &&
								"animate-spin motion-reduce:animate-none",
						)}
					/>
					{t("userReferrals.link.retry")}
				</Button>
			</div>
		);
	}

	if (summaryQuery.isPending || rewards === undefined) {
		return (
			<div aria-hidden className={cn("flex flex-col gap-3", className)}>
				<Skeleton className="h-11 w-full rounded-full" />
				<div className="flex gap-2">
					<Skeleton className="h-10 w-24 rounded-full max-sm:w-10" />
					<Skeleton className="h-10 w-24 rounded-full max-sm:w-10" />
					<Skeleton className="h-10 w-24 rounded-full max-sm:w-10" />
				</div>
			</div>
		);
	}

	const inviteUrl = buildInviteUrl(summaryQuery.data.code);
	const friendBonus = creditPhrase(rewards.friendCredits);
	const shareContent: ShareContent = {
		text: t("userReferrals.link.shareText", {
			friend: friendBonus,
			url: inviteUrl,
		}),
		inviteUrl,
		emailSubject: t("userReferrals.link.emailSubject", { friend: friendBonus }),
	};

	const copyLink = async () => {
		if (!(await copyToClipboard(inviteUrl))) {
			toast.error(t("userReferrals.link.copyFailed"));
			return;
		}
		toast.success(t("userReferrals.link.copied"));
		captureEvent("user_referral_link_copied", { surface });
	};

	const captureShare = (target: ShareTarget | "native") => {
		captureEvent("user_referral_share_clicked", { surface, target });
	};

	const openShareSheet = async () => {
		captureShare("native");
		try {
			await navigator.share({ text: shareContent.text });
		} catch (error) {
			// The browser throws an AbortError when the person closes the sheet. That is not a failure.
			if (error instanceof DOMException && error.name === "AbortError") return;
			console.error("Native share of the invite link failed", error);
			toast.error(t("userReferrals.link.shareFailed"));
		}
	};

	return (
		<div className={cn("flex flex-col gap-3", className)}>
			<div className="flex flex-col gap-2 sm:flex-row">
				<Input
					readOnly
					value={inviteUrl}
					dir="ltr"
					aria-label={t("userReferrals.link.label")}
					className="h-11 min-w-0 rounded-full border-night/10 bg-night/[0.04] px-4 font-mono text-night text-sm shadow-none sm:flex-1 dark:border-white/10 dark:bg-white/[0.06] dark:text-foreground"
					onFocus={(event) => event.currentTarget.select()}
				/>
				<Button
					type="button"
					onClick={() => void copyLink()}
					className="h-11 shrink-0 bg-night px-5 font-grotesk font-semibold text-paper hover:bg-night/90 dark:bg-spark dark:text-night dark:hover:bg-spark/90"
				>
					<CopySimpleIcon aria-hidden weight="bold" />
					{t("userReferrals.link.copy")}
				</Button>
			</div>
			<ul
				aria-label={t("userReferrals.link.shareLabel")}
				className="flex flex-wrap gap-2"
			>
				{BRAND_SHARE_TARGETS.map(({ target, name, TargetIcon }) => (
					<li key={target}>
						<a
							href={buildShareUrl(target, shareContent)}
							target="_blank"
							rel="noopener noreferrer"
							className={SHARE_PILL_CLASS}
							onClick={() => captureShare(target)}
						>
							<TargetIcon aria-hidden weight="fill" className="size-[18px]" />
							<span className={SHARE_NAME_CLASS}>{name}</span>
						</a>
					</li>
				))}
				<li>
					{/* A mailto link opens the mail app, so it needs no new tab. */}
					<a
						href={buildShareUrl("email", shareContent)}
						className={SHARE_PILL_CLASS}
						onClick={() => captureShare("email")}
					>
						<EnvelopeSimpleIcon
							aria-hidden
							weight="fill"
							className="size-[18px]"
						/>
						<span className={SHARE_NAME_CLASS}>
							{t("userReferrals.link.email")}
						</span>
					</a>
				</li>
				{/* Only a phone browser and Safari have the share sheet. */}
				{"share" in navigator ? (
					<li>
						<button
							type="button"
							className={SHARE_PILL_CLASS}
							onClick={() => void openShareSheet()}
						>
							<ShareNetworkIcon
								aria-hidden
								weight="fill"
								className="size-[18px]"
							/>
							<span className={SHARE_NAME_CLASS}>
								{t("userReferrals.link.nativeShare")}
							</span>
						</button>
					</li>
				) : null}
			</ul>
		</div>
	);
}
