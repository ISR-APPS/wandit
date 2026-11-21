/**
 * The "Your friends" card of the /refer page, with one row for each invited friend.
 * A row shows the status, the credits earned, and the next step. The page renders it and owns the summary query.
 * The loading, empty, and error states follow the table states of the affiliate portal.
 */
import { ArrowClockwiseIcon } from "@phosphor-icons/react/ArrowClockwise";
import { UsersThreeIcon } from "@phosphor-icons/react/UsersThree";
import { WarningIcon } from "@phosphor-icons/react/Warning";
import {
	USER_REFERRAL_ACTIVATION_MIN_CREDITS,
	USER_REFERRAL_PAID_HOLD_DAYS,
} from "@wandit/contracts";
import { formatDate, formatNumber } from "@wandit/internationalization";
import { Button } from "@wandit/ui/components/button";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";
import type { UserReferralFriend, UserReferralStatus } from "../api/dto";
import { isActivationWindowOpen } from "../lib/helpers";
import { type UserReferralRewards, useCreditPhrase } from "../lib/hooks";

type ReferralFriendsListProps = {
	/** True while the first load of the summary runs. */
	isPending: boolean;
	/** True when the summary request failed. */
	isError: boolean;
	/** True while a request runs. It locks the retry button, so a second click does not stack requests. */
	isFetching: boolean;
	onRetry: () => void;
	/** The newest friends from the summary, newest first. The API sends 50 at most. */
	friends: readonly UserReferralFriend[];
	/** Count of all friends of the user. It is above `friends.length` when the API cut the list. */
	joinedCount: number;
	/** Reward amounts for the next-step line of each row, from the public settings. */
	rewards: UserReferralRewards;
};

const SKELETON_KEYS = ["one", "two", "three"];

// Each status has one tone. Neutral: only joined. Blue: builds. Green: pays.
const STATUS_TONE_CLASS = {
	joined:
		"bg-night/[0.06] text-night/70 dark:bg-white/[0.08] dark:text-foreground/70",
	activated:
		"bg-blue-500/[0.12] text-blue-800 dark:bg-blue-400/15 dark:text-blue-300",
	subscribed:
		"bg-green-500/[0.12] text-green-800 dark:bg-green-400/15 dark:text-green-300",
} as const satisfies Record<UserReferralStatus, string>;

/** The white card with its title row. Its body is one of four: bars, the error, the empty state, or the rows. */
export function ReferralFriendsList({
	isPending,
	isError,
	isFetching,
	onRetry,
	friends,
	joinedCount,
	rewards,
}: ReferralFriendsListProps) {
	const { locale, t } = useTranslation();

	return (
		<section className="overflow-hidden rounded-[1.5rem] bg-white shadow-[0_2px_0_rgb(11_16_51/0.06)] ring-1 ring-night/[0.08] dark:bg-card dark:shadow-[0_2px_0_rgb(0_0_0/0.35)] dark:ring-white/10">
			<div className="flex min-h-16 items-center gap-2.5 border-night/[0.06] border-b px-4 py-3.5 sm:px-6 dark:border-white/[0.06]">
				<h3 className="font-grotesk font-semibold text-[15px] text-night tracking-[-0.01em] dark:text-foreground">
					{t("userReferrals.friends.title")}
				</h3>
				{joinedCount > 0 ? (
					<span className="rounded-full bg-night/[0.06] px-2 py-0.5 font-grotesk font-semibold text-night/60 text-xs tabular-nums dark:bg-white/[0.08] dark:text-foreground/60">
						{formatNumber(joinedCount, locale)}
					</span>
				) : null}
			</div>
			{isPending ? (
				<div className="flex flex-col gap-3 p-4 sm:p-6" aria-hidden>
					{SKELETON_KEYS.map((key) => (
						<Skeleton key={key} className="h-12 w-full rounded-xl" />
					))}
				</div>
			) : isError ? (
				<div
					role="alert"
					className="flex min-h-56 flex-col items-center justify-center bg-destructive/[0.035] px-6 py-12 text-center"
				>
					<span
						aria-hidden
						className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive"
					>
						<WarningIcon weight="duotone" className="size-5" />
					</span>
					<p className="mt-4 font-grotesk font-semibold text-night text-sm dark:text-foreground">
						{t("userReferrals.friends.loadError")}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="mt-4 rounded-full font-grotesk"
						disabled={isFetching}
						onClick={onRetry}
					>
						<ArrowClockwiseIcon
							aria-hidden
							weight="bold"
							className={cn(
								"size-4",
								isFetching && "animate-spin motion-reduce:animate-none",
							)}
						/>
						{t("userReferrals.link.retry")}
					</Button>
				</div>
			) : friends.length === 0 ? (
				<div className="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center">
					<span
						aria-hidden
						className="grid size-14 -rotate-6 place-items-center rounded-[28%] bg-spark/25 text-night dark:bg-spark/20 dark:text-spark"
					>
						<UsersThreeIcon weight="duotone" className="size-6" />
					</span>
					<p className="mt-5 font-bold font-grotesk text-lg text-night tracking-[-0.02em] dark:text-foreground">
						{t("userReferrals.friends.empty.title")}
					</p>
					<p className="mt-1 max-w-xs text-night/60 text-sm dark:text-foreground/60">
						{t("userReferrals.friends.empty.body")}
					</p>
				</div>
			) : (
				<>
					<ul className="divide-y divide-night/[0.06] dark:divide-white/[0.06]">
						{friends.map((friend) => (
							<FriendRow key={friend.id} friend={friend} rewards={rewards} />
						))}
					</ul>
					{/* The API has no pagination. The note tells the user that older friends are not in the list. */}
					{joinedCount > friends.length ? (
						<p className="border-night/[0.06] border-t px-4 py-3 text-night/60 text-xs sm:px-6 dark:border-white/[0.06] dark:text-foreground/60">
							{t("userReferrals.friends.newestNote", {
								count: friends.length,
								countDisplay: formatNumber(friends.length, locale),
							})}
						</p>
					) : null}
				</>
			)}
		</section>
	);
}

function FriendRow({
	friend,
	rewards,
}: {
	friend: UserReferralFriend;
	rewards: UserReferralRewards;
}) {
	const { locale, t } = useTranslation();
	const creditPhrase = useCreditPhrase();
	// The first letter of the name, for the round badge. The spread keeps a two-unit character whole.
	const initial = [...friend.displayName.trim()][0]?.toLocaleUpperCase(locale);

	let nextStep: string | null = null;
	if (friend.status === "joined") {
		// Product rule: a friend activates only in the days after the join. After the window, the row promises nothing.
		if (isActivationWindowOpen(friend.joinedAt, new Date())) {
			nextStep = t("userReferrals.friends.hints.activation", {
				activation: creditPhrase(rewards.activationCredits),
				min: creditPhrase(USER_REFERRAL_ACTIVATION_MIN_CREDITS),
			});
		}
	} else if (friend.status === "activated") {
		// `paidCredits` is null while no purchase is possible. The row then promises no paid reward.
		if (rewards.paidCredits !== null) {
			nextStep = t("userReferrals.friends.hints.paid", {
				paid: creditPhrase(rewards.paidCredits),
			});
		}
	} else if (friend.pendingCredits > 0) {
		// The friend paid. The paid reward waits for the end of its hold.
		nextStep = t("userReferrals.friends.hints.paidPending", {
			pending: creditPhrase(friend.pendingCredits),
			days: t("userReferrals.units.days", {
				count: USER_REFERRAL_PAID_HOLD_DAYS,
				countDisplay: formatNumber(USER_REFERRAL_PAID_HOLD_DAYS, locale),
			}),
		});
	}

	return (
		<li className="flex items-start gap-3 px-4 py-3.5 sm:px-6">
			<span
				aria-hidden
				className="grid size-9 shrink-0 place-items-center rounded-full bg-spark/25 font-grotesk font-semibold text-night text-sm dark:bg-spark/20 dark:text-spark"
			>
				{initial}
			</span>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
					{/* bdi keeps a name in its own direction inside an Arabic line. */}
					<p className="min-w-0 truncate font-grotesk font-semibold text-night text-sm dark:text-foreground">
						<bdi>{friend.displayName}</bdi>
					</p>
					<span
						className={cn(
							"inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 font-grotesk font-semibold text-[11px]",
							STATUS_TONE_CLASS[friend.status],
						)}
					>
						{t(`userReferrals.friends.status.${friend.status}`)}
					</span>
				</div>
				<p className="mt-0.5 text-night/60 text-xs dark:text-foreground/60">
					{t("userReferrals.friends.joinedOn", {
						date: formatDate(friend.joinedAt, locale, { dateStyle: "medium" }),
					})}
				</p>
				{nextStep === null ? null : (
					<p className="mt-1.5 text-night/80 text-xs dark:text-foreground/80">
						{nextStep}
					</p>
				)}
			</div>
			{friend.earnedCredits > 0 ? (
				<p className="shrink-0 pt-0.5 font-grotesk font-semibold text-night text-sm dark:text-foreground">
					{t("userReferrals.friends.earned", {
						credits: creditPhrase(friend.earnedCredits),
					})}
				</p>
			) : null}
		</li>
	);
}
