import type { ReactNode } from "react";

import type { AdminUserSummary } from "@/features/users/api/users.dto";
import {
	formatAdminDate,
	formatAdminDateTime,
	formatWholeNumber,
} from "@/features/users/lib/formatters";

import { UserRowActions } from "./user-row-actions";
import {
	PlanBadge,
	RoleBadge,
	StatusBadge,
	UserIdentity,
} from "./user-table-cells";

function UsersMobileList({ users }: { users: AdminUserSummary[] }) {
	return (
		<div className="space-y-3 lg:hidden">
			{users.map((user) => (
				<article
					key={user.id}
					className="overflow-hidden rounded-xl border bg-background"
				>
					<div className="flex items-center gap-3 border-b p-3">
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

					<div className="grid grid-cols-3 divide-x border-b">
						<MobileDatum label="Credits">
							<p className="font-medium font-mono tabular-nums">
								{formatWholeNumber(user.creditsBalance)}
							</p>
						</MobileDatum>
						<MobileDatum label="Credits used">
							<p className="font-medium font-mono tabular-nums">
								{formatWholeNumber(user.creditsConsumed)}
							</p>
						</MobileDatum>
						<MobileDatum label="Projects">
							<p className="font-medium font-mono tabular-nums">
								{formatWholeNumber(user.projectsCount)}
							</p>
						</MobileDatum>
					</div>

					<div className="grid grid-cols-2 divide-x border-b">
						<MobileDatum label="Status">
							<StatusBadge user={user} />
						</MobileDatum>
						<MobileDatum label="Last seen">
							<p className="text-muted-foreground tabular-nums">
								{formatAdminDateTime(user.lastSeenAt)}
							</p>
						</MobileDatum>
					</div>

					<div className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
						<span className="text-muted-foreground">
							Joined {formatAdminDate(user.createdAt)}
						</span>
					</div>
				</article>
			))}
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
