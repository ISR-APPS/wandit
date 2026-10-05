/**
 * The affiliate portal at `/affiliates`. It shows the partner header, the
 * metric cards, and four tabs: links, referrals, commissions, and payouts.
 * The route file imports it by path. It calls the affiliate portal queries
 * and renders the portal components of this feature.
 */
import { HandshakeIcon } from "@phosphor-icons/react/Handshake";
import { PauseCircleIcon } from "@phosphor-icons/react/PauseCircle";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type {
	AffiliateAttributionStatus,
	AffiliateCommissionStatus,
	AffiliatePortalProfile,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { Skeleton } from "@wandit/ui/components/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@wandit/ui/components/tabs";
import { useEffect, useState } from "react";

import {
	affiliatePortalKeys,
	useAffiliatePortalCommissionsQuery,
	useAffiliatePortalMeQuery,
	useAffiliatePortalOverviewQuery,
	useAffiliatePortalPayoutsQuery,
	useAffiliatePortalReferralsQuery,
} from "@/features/affiliates/api/affiliates.queries";
import { PortalCommissionsTable } from "@/features/affiliates/components/portal-commissions-table";
import { PortalLinksTable } from "@/features/affiliates/components/portal-links-table";
import { PortalPayoutsTable } from "@/features/affiliates/components/portal-payouts-table";
import { PortalReferralsTable } from "@/features/affiliates/components/portal-referrals-table";
import {
	PortalStatCards,
	PortalStatCardsSkeleton,
} from "@/features/affiliates/components/portal-stat-cards";
import { PortalStatusBadge } from "@/features/affiliates/components/portal-status-badge";
import {
	PortalRetryIcon,
	PortalTableError,
} from "@/features/affiliates/components/portal-table-states";
import { DashboardShell } from "@/features/projects/components/shell/dashboard-shell";
import { useTranslation } from "@/lib/i18n";

const PAGE_SIZE = 10;
const PORTAL_TABS = ["links", "referrals", "commissions", "payouts"] as const;

type PortalTab = (typeof PORTAL_TABS)[number];
type ReferralStatusFilter = AffiliateAttributionStatus | "all";
type CommissionStatusFilter = AffiliateCommissionStatus | "all";

/** The portal page. It asks `me` first: a user with no affiliate profile sees the partner notice. */
export default function AffiliatePortalPage() {
	const queryClient = useQueryClient();
	const meQuery = useAffiliatePortalMeQuery({ refetchOnMount: "always" });
	const retryPortal = () => {
		void queryClient.invalidateQueries({ queryKey: affiliatePortalKeys.all });
	};

	return (
		<DashboardShell titleKey="affiliates.title">
			<div className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-6">
				{meQuery.isPending ? (
					<PortalPageSkeleton />
				) : meQuery.isError ? (
					<PortalLoadError
						onRetry={retryPortal}
						retrying={meQuery.isFetching}
					/>
				) : meQuery.data.affiliate === null ? (
					<NotPartnerState
						onRefresh={() => void meQuery.refetch()}
						refreshing={meQuery.isFetching}
					/>
				) : (
					<AffiliatePortalContent
						affiliate={meQuery.data.affiliate}
						onRetryPortal={retryPortal}
					/>
				)}
			</div>
		</DashboardShell>
	);
}

function AffiliatePortalContent({
	affiliate,
	onRetryPortal,
}: {
	affiliate: AffiliatePortalProfile;
	onRetryPortal: () => void;
}) {
	const { t } = useTranslation();
	const [activeTab, setActiveTab] = useState<PortalTab>("links");
	const [referralPage, setReferralPage] = useState(1);
	const [referralStatus, setReferralStatus] =
		useState<ReferralStatusFilter>("all");
	const [commissionPage, setCommissionPage] = useState(1);
	const [commissionStatus, setCommissionStatus] =
		useState<CommissionStatusFilter>("all");
	const [payoutPage, setPayoutPage] = useState(1);
	const overviewQuery = useAffiliatePortalOverviewQuery();
	const referralsQuery = useAffiliatePortalReferralsQuery(
		{
			page: referralPage,
			pageSize: PAGE_SIZE,
			...(referralStatus === "all" ? {} : { status: referralStatus }),
		},
		{ enabled: activeTab === "referrals" },
	);
	const commissionsQuery = useAffiliatePortalCommissionsQuery(
		{
			page: commissionPage,
			pageSize: PAGE_SIZE,
			...(commissionStatus === "all" ? {} : { status: commissionStatus }),
		},
		{ enabled: activeTab === "commissions" },
	);
	const payoutsQuery = useAffiliatePortalPayoutsQuery(
		{ page: payoutPage, pageSize: PAGE_SIZE },
		{ enabled: activeTab === "payouts" },
	);
	const referralTotal = referralsQuery.data?.total;
	const commissionTotal = commissionsQuery.data?.total;
	const payoutTotal = payoutsQuery.data?.total;

	useEffect(() => {
		if (
			referralTotal !== undefined &&
			!referralsQuery.isFetching &&
			!referralsQuery.isError &&
			referralPage > getLastPage(referralTotal)
		) {
			setReferralPage(getLastPage(referralTotal));
		}
	}, [
		referralPage,
		referralTotal,
		referralsQuery.isError,
		referralsQuery.isFetching,
	]);

	useEffect(() => {
		if (
			commissionTotal !== undefined &&
			!commissionsQuery.isFetching &&
			!commissionsQuery.isError &&
			commissionPage > getLastPage(commissionTotal)
		) {
			setCommissionPage(getLastPage(commissionTotal));
		}
	}, [
		commissionPage,
		commissionTotal,
		commissionsQuery.isError,
		commissionsQuery.isFetching,
	]);

	useEffect(() => {
		if (
			payoutTotal !== undefined &&
			!payoutsQuery.isFetching &&
			!payoutsQuery.isError &&
			payoutPage > getLastPage(payoutTotal)
		) {
			setPayoutPage(getLastPage(payoutTotal));
		}
	}, [payoutPage, payoutTotal, payoutsQuery.isError, payoutsQuery.isFetching]);

	return (
		<>
			<div className="mt-8 flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2.5">
						<h2
							dir="auto"
							className="truncate font-bold font-grotesk text-[1.75rem] text-night tracking-[-0.035em] dark:text-foreground"
						>
							{affiliate.name}
						</h2>
						<PortalStatusBadge kind="affiliate" status={affiliate.status} />
					</div>
					<p className="mt-1 truncate font-mono text-night/60 text-xs dark:text-foreground/60">
						<span dir="ltr">{affiliate.email}</span>
					</p>
				</div>
			</div>

			{affiliate.status === "paused" ? (
				<div
					role="status"
					className="mt-5 flex items-start gap-3 rounded-[1.5rem] bg-spark/[0.12] px-4 py-3.5 text-night text-sm ring-1 ring-spark/30 dark:text-foreground"
				>
					{/* Night does not show on the dark page, so the icon turns spark there. */}
					<PauseCircleIcon
						aria-hidden
						weight="duotone"
						className="size-5 shrink-0 text-night dark:text-spark"
					/>
					<p>{t("affiliates.pausedNotice")}</p>
				</div>
			) : null}

			{overviewQuery.isPending ? (
				<OverviewSkeleton />
			) : overviewQuery.isError ? (
				<PortalLoadError
					onRetry={onRetryPortal}
					retrying={overviewQuery.isFetching}
				/>
			) : (
				<>
					<div className="mt-7">
						<PortalStatCards aggregates={overviewQuery.data.aggregates} />
					</div>

					<Tabs
						value={activeTab}
						className="mt-8 gap-4"
						onValueChange={(value) => {
							if (isPortalTab(value)) {
								setActiveTab(value);
							}
						}}
					>
						{/* The night pill of the dashboard filter. On a narrow phone the
						    list scrolls, and justify-start keeps the first tab in view. */}
						<TabsList className="h-9 max-w-full justify-start overflow-x-auto rounded-full border-0 bg-night/[0.05] p-1 [scrollbar-width:none] dark:bg-white/[0.06] [&::-webkit-scrollbar]:hidden">
							{PORTAL_TABS.map((tab) => (
								<TabsTrigger
									key={tab}
									value={tab}
									className="flex-none rounded-full px-3 font-grotesk font-semibold text-night/60 text-xs hover:text-night data-[state=active]:bg-night data-[state=active]:text-paper data-[state=active]:hover:text-paper dark:text-foreground/60 dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-spark dark:data-[state=active]:text-night dark:hover:text-foreground dark:data-[state=active]:hover:text-night"
								>
									{t(`affiliates.tabs.${tab}`)}
								</TabsTrigger>
							))}
						</TabsList>

						<TabsContent value="links">
							<PortalLinksTable items={overviewQuery.data.links} />
						</TabsContent>
						<TabsContent value="referrals">
							<PortalReferralsTable
								disabled={referralsQuery.isFetching}
								isError={referralsQuery.isError}
								isPending={referralsQuery.isPending}
								items={referralsQuery.data?.items ?? []}
								onPageChange={setReferralPage}
								onRetry={() => void referralsQuery.refetch()}
								onStatusChange={(status) => {
									setReferralStatus(status);
									setReferralPage(1);
								}}
								page={referralPage}
								pageSize={PAGE_SIZE}
								status={referralStatus}
								total={referralsQuery.data?.total ?? 0}
							/>
						</TabsContent>
						<TabsContent value="commissions">
							<PortalCommissionsTable
								disabled={commissionsQuery.isFetching}
								isError={commissionsQuery.isError}
								isPending={commissionsQuery.isPending}
								items={commissionsQuery.data?.items ?? []}
								onPageChange={setCommissionPage}
								onRetry={() => void commissionsQuery.refetch()}
								onStatusChange={(status) => {
									setCommissionStatus(status);
									setCommissionPage(1);
								}}
								page={commissionPage}
								pageSize={PAGE_SIZE}
								status={commissionStatus}
								total={commissionsQuery.data?.total ?? 0}
							/>
						</TabsContent>
						<TabsContent value="payouts">
							<PortalPayoutsTable
								disabled={payoutsQuery.isFetching}
								isError={payoutsQuery.isError}
								isPending={payoutsQuery.isPending}
								items={payoutsQuery.data?.items ?? []}
								onPageChange={setPayoutPage}
								onRetry={() => void payoutsQuery.refetch()}
								page={payoutPage}
								pageSize={PAGE_SIZE}
								total={payoutsQuery.data?.total ?? 0}
							/>
						</TabsContent>
					</Tabs>
				</>
			)}
		</>
	);
}

/** The signed-in user has no affiliate profile. Refresh asks `me` again, for a partner added a moment ago. */
function NotPartnerState({
	onRefresh,
	refreshing,
}: {
	onRefresh: () => void;
	refreshing: boolean;
}) {
	const { t } = useTranslation();

	return (
		<div className="mt-8 flex flex-col items-center justify-center rounded-[2rem] border-2 border-night/15 border-dashed px-6 py-16 text-center dark:border-white/15">
			<span
				aria-hidden
				className="grid size-16 -rotate-6 place-items-center rounded-[28%] bg-night shadow-[0_12px_22px_-12px_rgb(11_16_51/0.55)] dark:ring-1 dark:ring-white/10"
			>
				<HandshakeIcon weight="duotone" className="size-7 text-spark" />
			</span>
			<h2 className="mt-6 font-bold font-grotesk text-2xl text-night tracking-[-0.03em] dark:text-foreground">
				{t("affiliates.notPartner.title")}
			</h2>
			<p className="mt-2 max-w-xs text-night/60 text-sm dark:text-foreground/60">
				{t("affiliates.notPartner.body")}
			</p>
			<div className="mt-6 flex flex-wrap justify-center gap-2">
				<Button
					type="button"
					variant="outline"
					className="rounded-full font-grotesk"
					disabled={refreshing}
					onClick={onRefresh}
				>
					<PortalRetryIcon spinning={refreshing} />
					{t("affiliates.notPartner.refresh")}
				</Button>
				<Button asChild variant="outline" className="rounded-full font-grotesk">
					<Link to="/dashboard">
						{t("affiliates.notPartner.backToDashboard")}
					</Link>
				</Button>
			</div>
		</div>
	);
}

/**
 * The page cannot load `me` or the overview. A red frame around the table error body.
 * Retry marks every portal query stale. The active queries refetch.
 */
function PortalLoadError({
	onRetry,
	retrying,
}: {
	onRetry: () => void;
	retrying: boolean;
}) {
	// The error body has its own tint, so overflow-hidden clips it to the round frame.
	return (
		<div className="mt-8 overflow-hidden rounded-[2rem] border-2 border-destructive/25">
			<PortalTableError onRetry={onRetry} retrying={retrying} />
		</div>
	);
}

function PortalPageSkeleton() {
	return (
		<div className="mt-8" aria-hidden>
			<div className="flex flex-col gap-2">
				<Skeleton className="h-9 w-56 rounded-xl" />
				<Skeleton className="h-3 w-44 rounded-full" />
			</div>
			<OverviewSkeleton />
		</div>
	);
}

/** The metric cards, the tab pill, and the table card, in their real shapes. */
function OverviewSkeleton() {
	return (
		<div className="mt-7 flex flex-col gap-6" aria-hidden>
			<PortalStatCardsSkeleton />
			<Skeleton className="h-9 w-80 max-w-full rounded-full" />
			<Skeleton className="h-72 rounded-[1.5rem]" />
		</div>
	);
}

function isPortalTab(value: string): value is PortalTab {
	return PORTAL_TABS.some((tab) => tab === value);
}

function getLastPage(total: number) {
	return Math.max(1, Math.ceil(total / PAGE_SIZE));
}
