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

import { titleCase } from "./user-detail-helpers";

type UserSubscriptionCardProps = {
	subscription: AdminUserSubscription;
};

export function UserSubscriptionCard({
	subscription,
}: UserSubscriptionCardProps) {
	return (
		<Card className="shadow-none">
			<CardHeader>
				<CardTitle>Subscription</CardTitle>
				<CardDescription>
					Current plan and recurring billing information.
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
						label="Billing interval"
						value={subscription.interval === "month" ? "Monthly" : "Yearly"}
					/>
					<DetailItem
						label="Current period ends"
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
