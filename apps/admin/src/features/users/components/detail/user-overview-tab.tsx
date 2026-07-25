import {
	ActivityIcon,
	BanIcon,
	LogInIcon,
	RocketIcon,
	ShieldCheckIcon,
	SparklesIcon,
	UserPlusIcon,
	WalletCardsIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import type { AdminUserDetail } from "@/features/users/api/users.dto";
import {
	formatAdminDate,
	formatAdminDateTime,
	formatMinorCurrency,
} from "@/features/users/lib/formatters";

import {
	getRoleLabel,
	getSubscriptionLabel,
	titleCase,
} from "./user-detail-helpers";

type UserOverviewTabProps = {
	user: AdminUserDetail;
};

const activityIcons = {
	signup: UserPlusIcon,
	login: LogInIcon,
	generation: SparklesIcon,
	publish: RocketIcon,
	credit: WalletCardsIcon,
	admin: ShieldCheckIcon,
} satisfies Record<
	AdminUserDetail["activity"][number]["type"],
	typeof ActivityIcon
>;

export function UserOverviewTab({ user }: UserOverviewTabProps) {
	return (
		<div className="grid gap-4 xl:grid-cols-2">
			<Card className="shadow-none">
				<CardHeader>
					<CardTitle>Account</CardTitle>
					<CardDescription>
						Identity, access, and recent sign-in details.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
						<DetailItem label="Role" value={getRoleLabel(user.role)} />
						<DetailItem label="Email" value={user.email} />
						<DetailItem label="Country" value={user.country} />
						<DetailItem label="Locale" value={user.locale} />
						<DetailItem
							label="Signed up"
							value={formatAdminDate(user.signedUpAt)}
						/>
						<DetailItem
							label="Last active"
							value={formatAdminDateTime(user.lastSeenAt)}
						/>
					</dl>

					{user.isBanned ? (
						<div className="mt-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
							<BanIcon
								className="mt-0.5 shrink-0 text-destructive"
								aria-hidden="true"
							/>
							<div className="flex min-w-0 flex-col gap-1">
								<p className="font-medium text-sm">Account banned</p>
								<p className="text-muted-foreground text-sm">
									{user.banReason || "No administrator note was recorded."}
								</p>
								{user.bannedAt ? (
									<time
										dateTime={user.bannedAt}
										className="text-muted-foreground text-xs"
									>
										{formatAdminDateTime(user.bannedAt)}
									</time>
								) : null}
							</div>
						</div>
					) : null}
				</CardContent>
			</Card>

			<Card className="shadow-none">
				<CardHeader>
					<CardTitle>Subscription</CardTitle>
					<CardDescription>
						Current plan and recurring payment information.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
						<DetailItem label="Plan" value={titleCase(user.plan)} />
						<div className="flex min-w-0 flex-col gap-1">
							<dt className="text-muted-foreground text-xs">Status</dt>
							<dd>
								<Badge
									variant={
										user.subscriptionStatus === "past-due"
											? "destructive"
											: "outline"
									}
								>
									{getSubscriptionLabel(user.subscriptionStatus)}
								</Badge>
							</dd>
						</div>
						<DetailItem
							label="Provider"
							value={
								user.paymentProvider
									? titleCase(user.paymentProvider)
									: "Not connected"
							}
						/>
						<DetailItem
							label="Monthly amount"
							value={
								user.paymentProvider
									? formatMinorCurrency(user.monthlyAmountMinor, user.currency)
									: "Free"
							}
							tabular
						/>
						<DetailItem
							label="Renews"
							value={formatAdminDate(user.renewalAt)}
						/>
						<DetailItem
							label="Token cost"
							value={formatMinorCurrency(user.tokenCostUsdMinor, "USD")}
							tabular
						/>
					</dl>
				</CardContent>
			</Card>

			<Card className="shadow-none xl:col-span-2">
				<CardHeader>
					<CardTitle>Recent activity</CardTitle>
					<CardDescription>
						The latest product and administrative events for this user.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{user.activity.length > 0 ? (
						<ol className="flex flex-col divide-y">
							{user.activity.slice(0, 8).map((item) => {
								const Icon = activityIcons[item.type];

								return (
									<li
										key={item.id}
										className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"
									>
										<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
											<Icon aria-hidden="true" />
										</div>
										<div className="min-w-0 flex-1">
											<p className="font-medium text-sm">{item.title}</p>
											<p className="mt-1 text-muted-foreground text-sm">
												{item.description}
											</p>
										</div>
										<time
											dateTime={item.createdAt}
											className="hidden shrink-0 text-muted-foreground text-xs tabular-nums sm:block"
										>
											{formatAdminDateTime(item.createdAt)}
										</time>
									</li>
								);
							})}
						</ol>
					) : (
						<Empty className="min-h-56 border-0 p-6">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<ActivityIcon aria-hidden="true" />
								</EmptyMedia>
								<EmptyTitle>No activity yet</EmptyTitle>
								<EmptyDescription>
									Account and generation events will appear here.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

type DetailItemProps = {
	label: string;
	value: string;
	tabular?: boolean;
};

function DetailItem({ label, value, tabular = false }: DetailItemProps) {
	return (
		<div className="min-w-0">
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd
				className={
					tabular
						? "mt-1 truncate font-medium text-sm tabular-nums"
						: "mt-1 truncate font-medium text-sm"
				}
				title={value}
			>
				{value}
			</dd>
		</div>
	);
}
