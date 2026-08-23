import { isManualSubscription } from "@wandit/contracts";
import { CalendarPlusIcon, OctagonXIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useAdminPermission } from "@/features/auth/lib/permissions";
import { EndManualSubscriptionDialog } from "@/features/offline-billing/components/end-manual-subscription-dialog";
import { RenewManualSubscriptionDialog } from "@/features/offline-billing/components/renew-manual-subscription-dialog";
import type { AdminUserSubscription } from "@/features/users/api/users.dto";
import { formatAdminDate } from "@/features/users/lib/formatters";

import { subscriptionPriceUsd, titleCase } from "./user-detail-helpers";

type UserSubscriptionCardProps = {
	subscription: AdminUserSubscription;
	ownerLabel?: string;
};

export function UserSubscriptionCard({
	subscription,
	ownerLabel,
}: UserSubscriptionCardProps) {
	const canManageBilling = useAdminPermission({ billing: ["manage"] });
	const [activeDialog, setActiveDialog] = useState<"renew" | "end" | null>(
		null,
	);
	const priceUsd = subscriptionPriceUsd(subscription);
	const manual = isManualSubscription(subscription);

	return (
		<>
			<Card className="shadow-none">
				<CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
					<div className="space-y-1.5">
						<div className="flex flex-wrap items-center gap-2">
							<CardTitle>Subscription</CardTitle>
							<Badge variant={manual ? "secondary" : "outline"}>
								{manual ? "Paid offline" : "Stripe"}
							</Badge>
						</div>
						<CardDescription>
							{manual
								? "Current plan and manually funded billing period."
								: "Current plan and recurring billing information."}
						</CardDescription>
					</div>
					{manual && canManageBilling ? (
						<div className="flex flex-wrap items-center gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setActiveDialog("renew")}
							>
								<CalendarPlusIcon data-icon="inline-start" aria-hidden="true" />
								Renew
							</Button>
							<Button
								type="button"
								variant="destructive"
								size="sm"
								onClick={() => setActiveDialog("end")}
							>
								<OctagonXIcon data-icon="inline-start" aria-hidden="true" />
								End
							</Button>
						</div>
					) : null}
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
									? "Legacy price (not in catalog)"
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

			{manual && canManageBilling ? (
				<>
					<RenewManualSubscriptionDialog
						subscription={{
							id: subscription.id,
							interval: subscription.interval,
							currentPeriodEnd: subscription.currentPeriodEnd,
							entitled: subscription.status === "active",
							ownerLabel,
						}}
						open={activeDialog === "renew"}
						onOpenChange={(open) => setActiveDialog(open ? "renew" : null)}
					/>
					<EndManualSubscriptionDialog
						subscriptionId={subscription.id}
						ownerLabel={ownerLabel}
						open={activeDialog === "end"}
						onOpenChange={(open) => setActiveDialog(open ? "end" : null)}
					/>
				</>
			) : null}
		</>
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
