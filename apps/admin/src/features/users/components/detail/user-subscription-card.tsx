/**
 * Read-only history card of the last subscription of a user, from before pricing v8.
 * UserDetailPage renders it when the detail has a subscription. Uses the old plan catalog for the price.
 */
import { isManualSubscription } from "@wandit/contracts";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { AdminUserSubscription } from "@/features/users/api/users.dto";
import { formatAdminDate } from "@/features/users/lib/formatters";

import { subscriptionPriceUsd, titleCase } from "./user-detail-helpers";

type UserSubscriptionCardProps = {
	subscription: AdminUserSubscription;
};

/** Read-only card of the last plan. Plans end with pricing v8, so the card has no actions. */
export function UserSubscriptionCard({
	subscription,
}: UserSubscriptionCardProps) {
	const priceUsd = subscriptionPriceUsd(subscription);
	const manual = isManualSubscription(subscription);

	return (
		<Card className="shadow-none">
			<CardHeader className="space-y-1.5">
				<div className="flex flex-wrap items-center gap-2">
					<CardTitle>Subscription history</CardTitle>
					<Badge variant={manual ? "secondary" : "outline"}>
						{manual ? "Paid offline" : "Stripe"}
					</Badge>
				</div>
				<CardDescription>
					Plans end with pay as you go. This card shows the last plan for
					reference.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
					<DetailItem label="Plan" value={titleCase(subscription.plan)} />
					<div className="flex min-w-0 flex-col gap-1">
						<dt className="text-muted-foreground text-xs">Status</dt>
						<dd>
							<Badge
								variant={
									subscription.status === "active" ? "outline" : "secondary"
								}
								className="capitalize"
							>
								{titleCase(subscription.status)}
							</Badge>
						</dd>
					</div>
					<DetailItem
						label="Credit tier"
						value={
							subscription.pendingTierCredits === null
								? `${subscription.tierCredits.toLocaleString("en-US")} credits / month`
								: `${subscription.tierCredits.toLocaleString("en-US")} credits / month (downgrades to ${subscription.pendingTierCredits.toLocaleString("en-US")} at period end)`
						}
					/>
					<DetailItem
						label="Price"
						value={
							priceUsd === null
								? "Price unavailable"
								: `$${priceUsd.toLocaleString("en-US")} / ${subscription.interval}`
						}
					/>
					<DetailItem
						label="Billing interval"
						value={subscription.interval === "month" ? "Monthly" : "Yearly"}
					/>
					<DetailItem
						label={manual ? "Expires" : "Current period ends"}
						value={formatAdminDate(subscription.currentPeriodEnd)}
					/>
					<DetailItem
						label="Cancels at period end"
						value={subscription.cancelAtPeriodEnd ? "Yes" : "No"}
					/>
				</dl>
			</CardContent>
		</Card>
	);
}

function DetailItem({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0">
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd className="mt-1 truncate font-medium text-sm" title={value}>
				{value}
			</dd>
		</div>
	);
}
