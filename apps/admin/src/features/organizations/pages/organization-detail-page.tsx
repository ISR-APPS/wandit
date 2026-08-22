import { Link } from "@tanstack/react-router";
import {
	AlertCircleIcon,
	ArrowLeftIcon,
	Building2Icon,
	HandCoinsIcon,
	MailIcon,
	WalletCardsIcon,
} from "lucide-react";
import { type PropsWithChildren, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { GrantManualSubscriptionDialog } from "@/features/offline-billing/components/grant-manual-subscription-dialog";
import type { OrganizationDetail } from "@/features/organizations/api/organizations.dto";
import { useOrganizationQuery } from "@/features/organizations/api/organizations.queries";
import { GrantOrgCreditsDialog } from "@/features/organizations/components/grant-org-credits-dialog";
import { OrgMembersCard } from "@/features/organizations/components/org-members-card";
import { UserCreditLedger } from "@/features/users/components/detail/user-credit-ledger";
import { UserSubscriptionCard } from "@/features/users/components/detail/user-subscription-card";
import {
	formatAdminDate,
	formatWholeNumber,
} from "@/features/users/lib/formatters";
import { isApiClientError } from "@/lib/api-client";
import { formatCreditBalance } from "@/lib/credit-format";

type OrganizationDetailPageProps = {
	organizationId: string;
};

export function OrganizationDetailPage({
	organizationId,
}: OrganizationDetailPageProps) {
	const [grantOpen, setGrantOpen] = useState(false);
	const [offlineGrantOpen, setOfflineGrantOpen] = useState(false);
	const organizationQuery = useOrganizationQuery(organizationId);

	if (organizationQuery.isLoading) {
		return (
			<DetailContainer>
				<Skeleton className="h-24 w-full rounded-xl" />
				<Skeleton className="h-28 w-full rounded-xl" />
				<Skeleton className="h-72 w-full rounded-xl" />
			</DetailContainer>
		);
	}

	if (organizationQuery.isError) {
		const isMissing =
			isApiClientError(organizationQuery.error) &&
			organizationQuery.error.status === 404;

		return (
			<DetailContainer>
				<Empty className="min-h-(--content-full-height) border bg-background">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							{isMissing ? (
								<Building2Icon aria-hidden="true" />
							) : (
								<AlertCircleIcon aria-hidden="true" />
							)}
						</EmptyMedia>
						<EmptyTitle>
							{isMissing
								? "Organization not found"
								: "Could not load this organization"}
						</EmptyTitle>
						<EmptyDescription>
							{isMissing
								? "This workspace may have been removed, or the ID is incorrect."
								: "The organization record could not be read. Try the request again."}
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						{isMissing ? null : (
							<Button type="button" onClick={() => organizationQuery.refetch()}>
								Try again
							</Button>
						)}
						<Button asChild variant="outline">
							<Link to="/organizations">
								<ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
								Back to organizations
							</Link>
						</Button>
					</EmptyContent>
				</Empty>
			</DetailContainer>
		);
	}

	const detail = organizationQuery.data;

	if (!detail) {
		return null;
	}
	const attributionMember = detail.attributionUserId
		? detail.members.find(
				(member) => member.userId === detail.attributionUserId,
			)
		: undefined;
	const offlineBillingUser = detail.attributionUserId
		? {
				id: detail.attributionUserId,
				name: attributionMember?.name,
				email: attributionMember?.email,
			}
		: undefined;

	return (
		<DetailContainer>
			<DetailHeader
				detail={detail}
				onGrantCredits={() => setGrantOpen(true)}
				onGrantOffline={() => setOfflineGrantOpen(true)}
			/>
			<BalanceMetrics detail={detail} />

			<div className="grid gap-6 xl:grid-cols-2">
				{detail.subscription ? (
					<UserSubscriptionCard
						subscription={detail.subscription}
						ownerLabel={detail.name}
					/>
				) : null}
				<AttributionCard
					detail={detail}
					className={detail.subscription ? undefined : "xl:col-span-2"}
				/>
			</div>

			<OrgMembersCard
				organizationId={detail.id}
				members={detail.members}
				defaultMemberMonthlyCreditLimit={detail.defaultMemberMonthlyCreditLimit}
			/>

			<UserCreditLedger entries={detail.creditLedger} />

			<GrantOrgCreditsDialog
				organization={detail}
				open={grantOpen}
				onOpenChange={setGrantOpen}
			/>
			<GrantManualSubscriptionDialog
				open={offlineGrantOpen}
				onOpenChange={setOfflineGrantOpen}
				prefill={{
					user: offlineBillingUser,
					organization: { id: detail.id, name: detail.name },
				}}
			/>
		</DetailContainer>
	);
}

function DetailHeader({
	detail,
	onGrantCredits,
	onGrantOffline,
}: {
	detail: OrganizationDetail;
	onGrantCredits: () => void;
	onGrantOffline: () => void;
}) {
	return (
		<div className="flex flex-wrap items-start justify-between gap-4">
			<div className="flex min-w-0 items-start gap-3">
				<div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
					<Building2Icon aria-hidden="true" />
				</div>
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<h1 className="truncate font-semibold text-2xl tracking-tight">
							{detail.name}
						</h1>
						<Badge
							variant={detail.plan === "free" ? "outline" : "default"}
							className="capitalize"
						>
							{detail.plan}
						</Badge>
					</div>
					<p className="mt-1 text-muted-foreground text-sm">
						{detail.slug} · created {formatAdminDate(detail.createdAt)}
					</p>
				</div>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Button asChild variant="outline" size="sm">
					<Link to="/organizations">
						<ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
						All organizations
					</Link>
				</Button>
				{!detail.subscription ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onGrantOffline}
					>
						<HandCoinsIcon data-icon="inline-start" aria-hidden="true" />
						Grant offline subscription
					</Button>
				) : null}
				<Button type="button" size="sm" onClick={onGrantCredits}>
					<WalletCardsIcon data-icon="inline-start" aria-hidden="true" />
					Grant credits
				</Button>
			</div>
		</div>
	);
}

function BalanceMetrics({ detail }: { detail: OrganizationDetail }) {
	const metrics = [
		{ label: "Pool balance", value: detail.balance.balance },
		{ label: "Plan credits", value: detail.balance.plan },
		{ label: "Promo credits", value: detail.balance.promo },
		{ label: "Top-up credits", value: detail.balance.topup },
	];

	return (
		<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
			{metrics.map((metric) => (
				<Card key={metric.label} className="shadow-none">
					<CardContent className="py-4">
						<p className="text-muted-foreground text-xs">{metric.label}</p>
						<p className="mt-1 font-mono font-semibold text-xl tabular-nums">
							{formatCreditBalance(metric.value)}
						</p>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

function AttributionCard({
	detail,
	className,
}: {
	detail: OrganizationDetail;
	className?: string;
}) {
	return (
		<Card className={`shadow-none ${className ?? ""}`}>
			<CardHeader>
				<CardTitle>Workspace facts</CardTitle>
				<CardDescription>
					Provenance and pending activity for this team.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
					<FactItem label="Projects">
						{formatWholeNumber(detail.projectsCount)}
					</FactItem>
					<FactItem label="Members">
						{formatWholeNumber(detail.membersCount)}
					</FactItem>
					<FactItem label="Pending invitations">
						<span className="inline-flex items-center gap-1.5">
							<MailIcon className="size-3.5" aria-hidden="true" />
							{formatWholeNumber(detail.pendingInvitationsCount)}
						</span>
					</FactItem>
					<FactItem label="Affiliate attribution">
						{detail.attributionUserId ? (
							<Link
								to="/users/$userId"
								params={{ userId: detail.attributionUserId }}
								className="truncate font-mono text-xs hover:underline"
							>
								{detail.attributionUserId}
							</Link>
						) : (
							<span className="text-muted-foreground">
								No checkout yet — no Stripe customer
							</span>
						)}
					</FactItem>
					{detail.subscription?.purchasedByUserId ? (
						<FactItem label="Subscription purchased by">
							<Link
								to="/users/$userId"
								params={{ userId: detail.subscription.purchasedByUserId }}
								className="truncate font-mono text-xs hover:underline"
							>
								{detail.subscription.purchasedByUserId}
							</Link>
						</FactItem>
					) : null}
				</dl>
			</CardContent>
		</Card>
	);
}

function FactItem({ label, children }: PropsWithChildren<{ label: string }>) {
	return (
		<div className="flex min-w-0 flex-col gap-1">
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd className="min-w-0 font-medium text-sm">{children}</dd>
		</div>
	);
}

function DetailContainer({ children }: PropsWithChildren) {
	return (
		<div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
			{children}
		</div>
	);
}
