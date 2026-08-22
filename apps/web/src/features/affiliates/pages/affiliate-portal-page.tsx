import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type {
	AffiliateAttributionStatus,
	AffiliateCommissionStatus,
	AffiliatePortalProfile,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@wandit/ui/components/empty";
import { Skeleton } from "@wandit/ui/components/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@wandit/ui/components/tabs";
import { AlertTriangle, Handshake, PauseCircle, RefreshCw } from "lucide-react";
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
import { PortalStatCards } from "@/features/affiliates/components/portal-stat-cards";
import { PortalStatusBadge } from "@/features/affiliates/components/portal-status-badge";
import { DashboardShell } from "@/features/projects/components/shell/dashboard-shell";
import { useTranslation } from "@/lib/i18n";

const PAGE_SIZE = 10;
const PORTAL_TABS = ["links", "referrals", "commissions", "payouts"] as const;

type PortalTab = (typeof PORTAL_TABS)[number];
type ReferralStatusFilter = AffiliateAttributionStatus | "all";
type CommissionStatusFilter = AffiliateCommissionStatus | "all";

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
						<h2 className="truncate font-display font-semibold text-2xl tracking-tight">
							{affiliate.name}
						</h2>
						<PortalStatusBadge kind="affiliate" status={affiliate.status} />
					</div>
					<p className="mt-1 truncate font-mono text-muted-foreground text-xs">
						<span dir="ltr">{affiliate.email}</span>
					</p>
				</div>
			</div>

			{affiliate.status === "paused" ? (
				<div
					role="status"
					className="mt-5 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm"
				>
					<PauseCircle
						className="mt-0.5 size-4 shrink-0 text-primary"
						aria-hidden
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
						className="mt-8"
						onValueChange={(value) => {
							if (isPortalTab(value)) {
								setActiveTab(value);
							}
						}}
					>
						<TabsList className="max-w-full overflow-x-auto">
							<TabsTrigger value="links">
								{t("affiliates.tabs.links")}
							</TabsTrigger>
							<TabsTrigger value="referrals">
								{t("affiliates.tabs.referrals")}
							</TabsTrigger>
							<TabsTrigger value="commissions">
								{t("affiliates.tabs.commissions")}
							</TabsTrigger>
							<TabsTrigger value="payouts">
								{t("affiliates.tabs.payouts")}
							</TabsTrigger>
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

function NotPartnerState({
	onRefresh,
	refreshing,
}: {
	onRefresh: () => void;
	refreshing: boolean;
}) {
	const { t } = useTranslation();

	return (
		<Empty className="mt-8 min-h-[26rem] rounded-xl border border-dashed">
			<EmptyHeader>
				<EmptyMedia variant="icon" className="rounded-xl">
					<Handshake aria-hidden />
				</EmptyMedia>
				<EmptyTitle className="font-display text-base">
					{t("affiliates.notPartner.title")}
				</EmptyTitle>
				<EmptyDescription>{t("affiliates.notPartner.body")}</EmptyDescription>
			</EmptyHeader>
			<EmptyContent className="flex-row flex-wrap justify-center">
				<Button
					type="button"
					variant="outline"
					disabled={refreshing}
					onClick={onRefresh}
				>
					<RefreshCw data-icon="inline-start" aria-hidden />
					{t("affiliates.notPartner.refresh")}
				</Button>
				<Button asChild variant="outline">
					<Link to="/dashboard">
						{t("affiliates.notPartner.backToDashboard")}
					</Link>
				</Button>
			</EmptyContent>
		</Empty>
	);
}

function PortalLoadError({
	onRetry,
	retrying,
}: {
	onRetry: () => void;
	retrying: boolean;
}) {
	const { t } = useTranslation();

	return (
		<div
			role="alert"
			className="mt-8 rounded-xl border border-destructive/25 bg-destructive/[0.035] p-5"
		>
			<div className="flex items-start gap-3">
				<AlertTriangle
					className="mt-0.5 size-5 shrink-0 text-destructive"
					aria-hidden
				/>
				<div>
					<p className="font-medium text-sm">{t("affiliates.loadError")}</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="mt-4"
						disabled={retrying}
						onClick={onRetry}
					>
						<RefreshCw data-icon="inline-start" aria-hidden />
						{t("affiliates.retry")}
					</Button>
				</div>
			</div>
		</div>
	);
}

function PortalPageSkeleton() {
	return (
		<div className="mt-8 flex flex-col gap-6" aria-hidden>
			<div className="flex flex-col gap-2">
				<Skeleton className="h-8 w-56" />
				<Skeleton className="h-3 w-44" />
			</div>
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
				<Skeleton className="h-28 rounded-xl" />
				<Skeleton className="h-28 rounded-xl" />
				<Skeleton className="h-28 rounded-xl" />
			</div>
			<Skeleton className="h-80 rounded-xl" />
		</div>
	);
}

function OverviewSkeleton() {
	return (
		<div className="mt-7 flex flex-col gap-6" aria-hidden>
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
				<Skeleton className="h-28 rounded-xl" />
				<Skeleton className="h-28 rounded-xl" />
				<Skeleton className="h-28 rounded-xl" />
			</div>
			<Skeleton className="h-9 w-80 rounded-full" />
			<Skeleton className="h-72 rounded-xl" />
		</div>
	);
}

function isPortalTab(value: string): value is PortalTab {
	return PORTAL_TABS.some((tab) => tab === value);
}

function getLastPage(total: number) {
	return Math.max(1, Math.ceil(total / PAGE_SIZE));
}
