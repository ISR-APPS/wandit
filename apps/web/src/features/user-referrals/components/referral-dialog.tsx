/**
 * The compact referral dialog: the offer in one line, the invite link panel, and a link to /refer.
 * The gift buttons of the two project shells open it. The parent owns `open`.
 * The body loads the summary only while the dialog is open.
 */
import { ArrowRightIcon } from "@phosphor-icons/react/ArrowRight";
import { GiftIcon } from "@phosphor-icons/react/Gift";
import { Link } from "@tanstack/react-router";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@wandit/ui/components/dialog";

import { useTranslation } from "@/lib/i18n";
import { useCreditPhrase, useUserReferralRewards } from "../lib/hooks";
import { ReferralLinkPanel } from "./referral-link-panel";

/** Props of ReferralDialog. The button that opens the dialog keeps the state. */
export type ReferralDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** The dialog frame. Radix mounts the content only while `open` is true, so the body hooks run only then. */
export function ReferralDialog({ open, onOpenChange }: ReferralDialogProps) {
	const { t } = useTranslation();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-h-[90svh] overflow-y-auto sm:max-w-md"
				closeLabel={t("common.close")}
			>
				<ReferralDialogBody onLeave={() => onOpenChange(false)} />
			</DialogContent>
		</Dialog>
	);
}

function ReferralDialogBody({
	onLeave,
}: {
	/** Closes the dialog when the person follows the link to /refer. */
	onLeave: () => void;
}) {
	const { t } = useTranslation();
	const creditPhrase = useCreditPhrase();
	const rewards = useUserReferralRewards();

	return (
		<>
			<DialogHeader className="items-center sm:items-start">
				<span
					aria-hidden
					className="mb-1 grid size-10 place-items-center rounded-full bg-spark text-night"
				>
					<GiftIcon weight="fill" className="size-5" />
				</span>
				<DialogTitle className="font-grotesk">
					{t("userReferrals.dialog.title")}
				</DialogTitle>
				{/* The line is empty until the amounts load. The fixed height stops a jump. */}
				<DialogDescription className="min-h-5">
					{rewards === undefined
						? null
						: t("userReferrals.hero.offer", {
								friend: creditPhrase(rewards.friendCredits),
								max: creditPhrase(rewards.maxCredits),
							})}
				</DialogDescription>
			</DialogHeader>
			<ReferralLinkPanel surface="dialog" />
			<Link
				to="/refer"
				onClick={onLeave}
				className="inline-flex items-center gap-1.5 self-start justify-self-start rounded-full font-grotesk font-semibold text-night text-sm underline-offset-4 outline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ember dark:text-foreground"
			>
				{t("userReferrals.dialog.seeRewards")}
				{/* The arrow points to the end of the line, so it flips in Arabic. */}
				<ArrowRightIcon
					aria-hidden
					weight="bold"
					className="size-4 rtl:-scale-x-100"
				/>
			</Link>
		</>
	);
}
