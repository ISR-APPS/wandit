/**
 * The /refer account page: the invite link, the three steps, the totals of the user, and the invited friends.
 * routes/_auth/refer.tsx renders it, only while the program is on. It renders inside DashboardShell.
 * It reads the summary query and the reward amounts of the public settings.
 */
import { GiftIcon } from "@phosphor-icons/react/Gift";
import { InfoIcon } from "@phosphor-icons/react/Info";
import {
	USER_REFERRAL_ACTIVATION_CAP,
	USER_REFERRAL_ACTIVATION_MIN_CREDITS,
	USER_REFERRAL_ACTIVATION_WINDOW_DAYS,
	USER_REFERRAL_PAID_HOLD_DAYS,
} from "@wandit/contracts";
import { formatNumber } from "@wandit/internationalization";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";

import { Spark } from "@/components/logo";
import { formatCreditAmount } from "@/features/credits";
import { DashboardShell } from "@/features/projects";
import { useWorkspace } from "@/features/workspaces";
import { useTranslation } from "@/lib/i18n";
import type { UserReferralSummary } from "../api/dto";
import { useUserReferralSummaryQuery } from "../api/user-referrals.queries";
import { ReferralFriendsList } from "../components/referral-friends-list";
import { ReferralLinkPanel } from "../components/referral-link-panel";
import {
	type UserReferralRewards,
	useCreditPhrase,
	useUserReferralRewards,
} from "../lib/hooks";

// The white card of the dashboard pages, the same as on the billing page.
const CARD_CLASS =
	"rounded-[1.5rem] bg-white shadow-[0_2px_0_rgb(11_16_51/0.06)] ring-1 ring-night/[0.08] dark:bg-card dark:shadow-[0_2px_0_rgb(0_0_0/0.35)] dark:ring-white/10";

const SECTION_TITLE_CLASS =
	"font-bold font-grotesk text-night text-xl tracking-[-0.03em] dark:text-foreground";

// The small capitals above a number. Arabic letters join, so `rtl:` removes the letter spacing.
const TILE_LABEL_CLASS =
	"font-grotesk font-semibold text-[11px] uppercase tracking-[0.08em] rtl:tracking-normal";

const TILE_VALUE_CLASS =
	"mt-2 font-bold font-grotesk text-[1.75rem] tabular-nums leading-tight tracking-[-0.035em]";

const TILE_SKELETON_KEYS = ["earned", "joined", "activated"];

/** The rewards belong to the user, not to a workspace, so every workspace shows the same page. */
export default function ReferPage() {
	const { t } = useTranslation();
	const creditPhrase = useCreditPhrase();
	const rewards = useUserReferralRewards();
	const summaryQuery = useUserReferralSummaryQuery();
	const { isPersonal } = useWorkspace();

	return (
		<DashboardShell titleKey="userReferrals.title">
			<div className="mx-auto w-full max-w-4xl px-4 pb-16 md:px-6">
				{/* The link panel sits on the ember panel of the dashboard, so the page opens with the action. */}
				<section className="relative mt-4 overflow-hidden rounded-[2rem] bg-ember px-4 py-10 md:mt-6 md:px-10 md:py-14">
					<Spark className="pointer-events-none absolute -end-12 -top-12 size-56 text-white/10 md:-end-8 md:-top-10" />
					<div className="relative mx-auto flex w-full max-w-2xl flex-col items-center text-center">
						{rewards === undefined ? (
							<Skeleton className="h-7 w-44 rounded-full bg-night/20" />
						) : (
							<p className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-night px-3 py-1 font-grotesk font-semibold text-spark text-xs">
								<GiftIcon aria-hidden weight="fill" className="size-3.5" />
								{t("userReferrals.hero.badge", {
									max: creditPhrase(rewards.maxCredits),
								})}
							</p>
						)}
						{/* Large bold white text passes 3:1 on ember; small text would not. */}
						<h2 className="mt-5 text-balance font-extrabold font-grotesk text-[clamp(2rem,4.2vw,3.25rem)] text-white leading-[0.95] tracking-[-0.045em] rtl:leading-[1.3] rtl:tracking-normal">
							{t("userReferrals.hero.headline")}
						</h2>
						{/* Small text on ember is night, like the hero line of the landing. */}
						<p className="mt-4 min-h-6 max-w-xl text-balance text-[15px] text-night">
							{rewards === undefined
								? null
								: t("userReferrals.hero.offer", {
										friend: creditPhrase(rewards.friendCredits),
										max: creditPhrase(rewards.maxCredits),
									})}
						</p>
						{/* The box is a key on an ember-deep edge, like the prompt box of the dashboard. */}
						<div className="mt-7 w-full rounded-3xl bg-white p-3 text-start shadow-[0_7px_0_var(--color-ember-deep)] sm:p-4 dark:bg-card">
							<ReferralLinkPanel surface="page" />
						</div>
					</div>
				</section>

				{/* Product rule: the rewards go to the personal pool, also when the user works in a team workspace. */}
				{isPersonal ? null : (
					<p className="mt-4 flex items-start gap-2.5 rounded-2xl bg-spark/[0.12] px-4 py-3 text-night text-sm ring-1 ring-spark/30 dark:text-foreground">
						{/* Night does not show on the dark page, so the icon turns spark there. */}
						<InfoIcon
							aria-hidden
							weight="fill"
							className="mt-0.5 size-4 shrink-0 text-night dark:text-spark"
						/>
						{t("userReferrals.hero.personalWorkspaceNote")}
					</p>
				)}

				{rewards === undefined ? null : (
					<>
						<HowItWorks rewards={rewards} />
						<div className="mt-12 flex flex-col gap-4">
							{/* After a failed load, the friends card shows the error and the retry button. */}
							{summaryQuery.isError ? null : (
								<section>
									<h3 className={SECTION_TITLE_CLASS}>
										{t("userReferrals.stats.title")}
									</h3>
									{summaryQuery.isPending ? (
										<div
											aria-hidden
											className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3"
										>
											{TILE_SKELETON_KEYS.map((key) => (
												<Skeleton
													key={key}
													className="h-28 rounded-[1.5rem] first:col-span-2 lg:first:col-span-1"
												/>
											))}
										</div>
									) : (
										<StatTiles
											stats={summaryQuery.data.stats}
											showsSubscribed={rewards.paidCredits !== null}
										/>
									)}
								</section>
							)}
							<ReferralFriendsList
								isPending={summaryQuery.isPending}
								isError={summaryQuery.isError}
								isFetching={summaryQuery.isFetching}
								onRetry={() => void summaryQuery.refetch()}
								friends={summaryQuery.data?.friends ?? []}
								joinedCount={summaryQuery.data?.stats.joinedCount ?? 0}
								rewards={rewards}
							/>
						</div>
					</>
				)}

				<ProgramRules />
			</div>
		</DashboardShell>
	);
}

/** The steps of the program, one card each. The paid step shows only while a friend can pay. */
function HowItWorks({ rewards }: { rewards: UserReferralRewards }) {
	const { locale, t } = useTranslation();
	const creditPhrase = useCreditPhrase();

	const steps = [
		{
			id: "share",
			title: t("userReferrals.steps.share.title"),
			body: t("userReferrals.steps.share.body", {
				friend: creditPhrase(rewards.friendCredits),
			}),
		},
		{
			id: "build",
			title: t("userReferrals.steps.build.title"),
			body: t("userReferrals.steps.build.body", {
				min: creditPhrase(USER_REFERRAL_ACTIVATION_MIN_CREDITS),
				activation: creditPhrase(rewards.activationCredits),
			}),
		},
	];
	if (rewards.paidCredits !== null) {
		steps.push({
			id: "subscribe",
			title: t("userReferrals.steps.subscribe.title"),
			body: t("userReferrals.steps.subscribe.body", {
				days: t("userReferrals.units.days", {
					count: USER_REFERRAL_PAID_HOLD_DAYS,
					countDisplay: formatNumber(USER_REFERRAL_PAID_HOLD_DAYS, locale),
				}),
				paid: creditPhrase(rewards.paidCredits),
			}),
		});
	}

	return (
		<section className="mt-12">
			<h3 className={SECTION_TITLE_CLASS}>{t("userReferrals.steps.title")}</h3>
			<ol
				className={cn(
					"mt-4 grid gap-3",
					// The grid has one column for each step, so no cell stays empty.
					steps.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2",
				)}
			>
				{steps.map((step, index) => (
					<li
						key={step.id}
						className={cn(
							CARD_CLASS,
							"flex items-start gap-4 p-5 md:flex-col md:gap-0",
						)}
					>
						<span
							aria-hidden
							className="grid size-9 shrink-0 place-items-center rounded-full bg-night font-bold font-grotesk text-sm text-spark dark:bg-spark dark:text-night"
						>
							{formatNumber(index + 1, locale)}
						</span>
						<div className="min-w-0 md:mt-4">
							<p className="font-grotesk font-semibold text-[15px] text-night tracking-[-0.01em] dark:text-foreground">
								{step.title}
							</p>
							<p className="mt-1 text-night/60 text-sm dark:text-foreground/60">
								{step.body}
							</p>
						</div>
					</li>
				))}
			</ol>
		</section>
	);
}

/** The totals of the user: the credits earned on the night tile, then one count tile for each stage. */
function StatTiles({
	stats,
	showsSubscribed,
}: {
	/** Totals over all friends of the user, from the summary. Credit values are decimal credits. */
	stats: UserReferralSummary["stats"];
	/** False while no purchase is possible. The "subscribed" tile then stays hidden. */
	showsSubscribed: boolean;
}) {
	const { locale, t } = useTranslation();
	const creditPhrase = useCreditPhrase();

	return (
		<div
			className={cn(
				"mt-4 grid grid-cols-2 gap-3",
				showsSubscribed ? "lg:grid-cols-4" : "lg:grid-cols-3",
			)}
		>
			<div className="col-span-2 rounded-[1.5rem] bg-night p-5 text-paper lg:col-span-1 dark:bg-card dark:text-foreground dark:ring-1 dark:ring-spark/40">
				<p
					className={cn(
						TILE_LABEL_CLASS,
						"text-paper/60 dark:text-foreground/60",
					)}
				>
					{t("userReferrals.stats.earned")}
				</p>
				<p className={cn(TILE_VALUE_CLASS, "text-spark")}>
					<span dir="ltr">
						{formatCreditAmount(stats.earnedCredits, locale)}
					</span>
				</p>
				{stats.pendingCredits > 0 ? (
					<p className="mt-1 text-paper/70 text-xs dark:text-foreground/70">
						{t("userReferrals.stats.pending", {
							pending: creditPhrase(stats.pendingCredits),
						})}
					</p>
				) : null}
			</div>
			<CountTile
				label={t("userReferrals.stats.joined")}
				value={formatNumber(stats.joinedCount, locale)}
			/>
			<CountTile
				label={t("userReferrals.stats.activated")}
				value={formatNumber(stats.activatedCount, locale)}
			/>
			{showsSubscribed ? (
				<CountTile
					// On a phone the fourth tile is alone on its row, so it takes the two columns.
					className="col-span-2 lg:col-span-1"
					label={t("userReferrals.stats.subscribed")}
					value={formatNumber(stats.subscribedCount, locale)}
				/>
			) : null}
		</div>
	);
}

function CountTile({
	label,
	value,
	className,
}: {
	label: string;
	/** The count, already formatted for the locale. */
	value: string;
	className?: string;
}) {
	return (
		<div className={cn(CARD_CLASS, "p-5", className)}>
			<p
				className={cn(
					TILE_LABEL_CLASS,
					"text-night/60 dark:text-foreground/60",
				)}
			>
				{label}
			</p>
			<p className={cn(TILE_VALUE_CLASS, "text-night dark:text-foreground")}>
				<span dir="ltr">{value}</span>
			</p>
		</div>
	);
}

/** The short rules of the program. The numbers come from the contract constants. */
function ProgramRules() {
	const { locale, t } = useTranslation();
	const creditPhrase = useCreditPhrase();

	const rules = [
		{ id: "newAccounts", text: t("userReferrals.rules.newAccounts") },
		{
			id: "window",
			text: t("userReferrals.rules.window", {
				days: t("userReferrals.units.days", {
					count: USER_REFERRAL_ACTIVATION_WINDOW_DAYS,
					countDisplay: formatNumber(
						USER_REFERRAL_ACTIVATION_WINDOW_DAYS,
						locale,
					),
				}),
				min: creditPhrase(USER_REFERRAL_ACTIVATION_MIN_CREDITS),
				friends: t("userReferrals.units.friends", {
					count: USER_REFERRAL_ACTIVATION_CAP,
					countDisplay: formatNumber(USER_REFERRAL_ACTIVATION_CAP, locale),
				}),
			}),
		},
		{ id: "noCash", text: t("userReferrals.rules.noCash") },
		{ id: "abuse", text: t("userReferrals.rules.abuse") },
	];

	return (
		<section className="mt-12 rounded-[1.5rem] bg-night/[0.03] p-5 ring-1 ring-night/[0.06] sm:p-6 dark:bg-white/[0.04] dark:ring-white/10">
			<h3 className="font-grotesk font-semibold text-[15px] text-night tracking-[-0.01em] dark:text-foreground">
				{t("userReferrals.rules.title")}
			</h3>
			<ul className="mt-3 flex flex-col gap-2 text-night/70 text-sm dark:text-foreground/70">
				{rules.map((rule) => (
					<li key={rule.id} className="flex items-start gap-2.5">
						<span
							aria-hidden
							className="mt-2 size-1.5 shrink-0 rounded-full bg-spark"
						/>
						{rule.text}
					</li>
				))}
			</ul>
		</section>
	);
}
