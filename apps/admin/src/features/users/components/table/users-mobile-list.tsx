import type { Row } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import type { AdminUserSummary } from "@/features/users/api/users.dto";
import {
	formatAdminDate,
	formatCompactNumber,
	formatMinorCurrency,
	formatWholeNumber,
} from "@/features/users/lib/formatters";

import { UserRowActions } from "./user-row-actions";
import {
	AccountBadge,
	PaymentProviderBadge,
	PlanBadge,
	RoleBadge,
	SubscriptionBadge,
	UserIdentity,
} from "./user-table-cells";

function UsersMobileList({ rows }: { rows: Row<AdminUserSummary>[] }) {
	return (
		<div className="space-y-3 lg:hidden">
			{rows.map((row) => {
				const user = row.original;

				return (
					<article
						key={user.id}
						data-state={row.getIsSelected() ? "selected" : undefined}
						className="overflow-hidden rounded-xl border bg-background data-[state=selected]:border-primary/35 data-[state=selected]:bg-muted/35"
					>
						<div className="flex items-center gap-3 border-b p-3">
							<Checkbox
								checked={row.getIsSelected()}
								onCheckedChange={(value) => row.toggleSelected(!!value)}
								aria-label={`Select ${user.name}`}
							/>
							<div className="min-w-0 flex-1">
								<UserIdentity user={user} />
							</div>
							<UserRowActions user={user} />
						</div>

						<div className="grid grid-cols-2 divide-x border-b">
							<MobileDatum label="Role">
								<RoleBadge role={user.role} />
							</MobileDatum>
							<MobileDatum label="Plan">
								<PlanBadge plan={user.plan} />
							</MobileDatum>
						</div>

						<div className="grid grid-cols-2 divide-x border-b">
							<MobileDatum label="Subscription">
								<SubscriptionBadge status={user.subscriptionStatus} />
							</MobileDatum>
							<MobileDatum label="Monthly">
								<p className="font-medium font-mono tabular-nums">
									{formatMinorCurrency(user.monthlyAmountMinor, user.currency)}
								</p>
								<div className="mt-1">
									<PaymentProviderBadge provider={user.paymentProvider} />
								</div>
							</MobileDatum>
						</div>

						<div className="grid grid-cols-2 divide-x border-b">
							<MobileDatum label="Credits">
								<p className="font-medium font-mono tabular-nums">
									{formatWholeNumber(user.creditsBalance)}
								</p>
							</MobileDatum>
							<MobileDatum label="Tokens used">
								<p className="font-medium font-mono tabular-nums">
									{formatCompactNumber(user.tokensLifetime)}
								</p>
								<p className="text-muted-foreground text-xs">
									{formatMinorCurrency(user.tokenCostUsdMinor, "USD")}
								</p>
							</MobileDatum>
						</div>

						<div className="grid grid-cols-2 divide-x border-b">
							<MobileDatum label="Generations">
								<p className="font-mono tabular-nums">
									{formatWholeNumber(user.websitesGenerated)} websites
								</p>
								<p className="text-muted-foreground text-xs">
									{formatWholeNumber(user.assetsGenerated)} assets
								</p>
							</MobileDatum>
							<MobileDatum label="Account">
								<AccountBadge user={user} />
							</MobileDatum>
						</div>

						<div className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
							<span className="text-muted-foreground">
								Joined {formatAdminDate(user.signedUpAt)}
							</span>
							<span className="truncate text-muted-foreground">
								{user.country}
							</span>
						</div>
					</article>
				);
			})}
		</div>
	);
}

function MobileDatum({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="min-w-0 space-y-1 px-3 py-3">
			<p className="text-muted-foreground text-xs">{label}</p>
			<div className="min-w-0 text-sm">{children}</div>
		</div>
	);
}

export { UsersMobileList };
