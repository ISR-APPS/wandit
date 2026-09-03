import { Link } from "@tanstack/react-router";
import {
	CalendarPlusIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	EllipsisIcon,
	EyeIcon,
	OctagonXIcon,
	PrinterIcon,
	RefreshCwIcon,
	SearchIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useAdminPermission } from "@/features/auth/lib/permissions";
import type {
	AdminManualSubscription,
	AdminManualSubscriptionStatusFilter,
} from "@/features/offline-billing/api/offline-billing.dto";
import { useManualSubscriptionsQuery } from "@/features/offline-billing/api/offline-billing.queries";
import { daysUntil } from "@/features/offline-billing/lib/offline-billing";
import {
	formatAdminDate,
	formatAdminDateTime,
	formatWholeNumber,
} from "@/features/users/lib/formatters";

import { EndManualSubscriptionDialog } from "./end-manual-subscription-dialog";
import { ManualSubscriptionDetailSheet } from "./manual-subscription-detail-sheet";
import {
	ManualSubscriptionGraceBadge,
	ManualSubscriptionStatusBadge,
} from "./offline-billing-badges";
import { RenewManualSubscriptionDialog } from "./renew-manual-subscription-dialog";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 25;

const STATUS_LABELS: Record<AdminManualSubscriptionStatusFilter, string> = {
	active: "Active subscriptions",
	ended: "Ended subscriptions",
	all: "All subscriptions",
};

export function ManualSubscriptionsTable() {
	const [page, setPage] = useState(1);
	const [status, setStatus] =
		useState<AdminManualSubscriptionStatusFilter>("active");
	const [searchValue, setSearchValue] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [detailSubscriptionId, setDetailSubscriptionId] = useState<
		string | null
	>(null);

	useEffect(() => {
		const handle = setTimeout(() => {
			setDebouncedQuery(searchValue.trim());
		}, SEARCH_DEBOUNCE_MS);

		return () => clearTimeout(handle);
	}, [searchValue]);

	// A changed filter starts at the first result page.
	// biome-ignore lint/correctness/useExhaustiveDependencies: page reset is intentional
	useEffect(() => {
		setPage(1);
	}, [debouncedQuery, status]);

	const subscriptionsQuery = useManualSubscriptionsQuery({
		page,
		pageSize: PAGE_SIZE,
		status,
		q: debouncedQuery || undefined,
	});
	const result = subscriptionsQuery.data;
	const totalPages = result
		? Math.max(1, Math.ceil(result.total / PAGE_SIZE))
		: 1;

	useEffect(() => {
		if (result && !subscriptionsQuery.isFetching && page > totalPages) {
			setPage(totalPages);
		}
	}, [page, result, subscriptionsQuery.isFetching, totalPages]);

	return (
		<div className="space-y-4">
			{subscriptionsQuery.isError && result ? (
				<div
					role="alert"
					className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-destructive text-sm"
				>
					<span>
						These subscriptions could not be refreshed and may be out of date.
					</span>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => void subscriptionsQuery.refetch()}
					>
						<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
						Retry
					</Button>
				</div>
			) : null}

			{subscriptionsQuery.isPending ? (
				<Card className="shadow-none">
					<CardContent className="flex flex-col gap-3 py-6">
						<Skeleton className="h-9 w-full max-w-xl" />
						{Array.from({ length: 6 }, (_, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
							<Skeleton key={index} className="h-14 w-full" />
						))}
					</CardContent>
				</Card>
			) : subscriptionsQuery.isError && !result ? (
				<Empty className="min-h-[420px] border bg-background">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<CalendarPlusIcon aria-hidden="true" />
						</EmptyMedia>
						<EmptyTitle>Offline subscriptions could not be loaded</EmptyTitle>
						<EmptyDescription>
							The server did not respond. Retry the request to restore the
							table.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button
							type="button"
							onClick={() => void subscriptionsQuery.refetch()}
						>
							<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
							Retry
						</Button>
					</EmptyContent>
				</Empty>
			) : result ? (
				<Card className="shadow-none">
					<CardContent className="flex flex-col gap-4 pt-6">
						<div className="flex flex-wrap items-center gap-3">
							<div className="relative min-w-0 flex-1 sm:max-w-sm">
								<SearchIcon
									className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
									aria-hidden="true"
								/>
								<Input
									value={searchValue}
									onChange={(event) => setSearchValue(event.target.value)}
									placeholder="Search owner, contact, or email"
									className="ps-9"
									aria-label="Search offline subscriptions"
									maxLength={200}
								/>
							</div>
							<Select
								value={status}
								onValueChange={(value) =>
									setStatus(value as AdminManualSubscriptionStatusFilter)
								}
							>
								<SelectTrigger
									className="w-48"
									aria-label="Filter subscription status"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{Object.entries(STATUS_LABELS).map(([value, label]) => (
										<SelectItem key={value} value={value}>
											{label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{result.items.length === 0 ? (
							<div className="py-10 text-center">
								<p className="font-medium text-sm">
									{status === "active" && !debouncedQuery
										? "No active offline subscriptions"
										: "No subscriptions match the current filters"}
								</p>
								<p className="mt-1 text-muted-foreground text-sm">
									Use the status filter to review ended subscriptions.
								</p>
							</div>
						) : (
							<div className="overflow-x-auto">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Owner</TableHead>
											<TableHead>Plan</TableHead>
											<TableHead>Current period</TableHead>
											<TableHead>Time left</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Payments</TableHead>
											<TableHead>Created</TableHead>
											<TableHead className="w-12">
												<span className="sr-only">Actions</span>
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{result.items.map((subscription) => (
											<TableRow key={subscription.id}>
												<TableCell>
													{subscription.organization ? (
														<Link
															to="/organizations/$organizationId"
															params={{
																organizationId: subscription.organization.id,
															}}
															className="block max-w-52 hover:underline"
														>
															<span className="block truncate font-medium">
																{subscription.organization.name}
															</span>
															<span className="block truncate text-muted-foreground text-xs">
																Contact: {subscription.user.name}
															</span>
														</Link>
													) : (
														<Link
															to="/users/$userId"
															params={{ userId: subscription.user.id }}
															className="block max-w-52 hover:underline"
														>
															<span className="block truncate font-medium">
																{subscription.user.name}
															</span>
															<span className="block truncate text-muted-foreground text-xs">
																{subscription.user.email}
															</span>
														</Link>
													)}
												</TableCell>
												<TableCell>
													<p className="text-sm capitalize">
														{subscription.plan} ·{" "}
														{subscription.tierCredits.toLocaleString("en-US")}
													</p>
													<p className="text-muted-foreground text-xs">
														{subscription.interval === "month"
															? "Monthly"
															: "Yearly"}
													</p>
												</TableCell>
												<TableCell className="whitespace-nowrap text-muted-foreground text-sm">
													{formatAdminDate(subscription.currentPeriodStart)} →{" "}
													{formatAdminDate(subscription.currentPeriodEnd)}
												</TableCell>
												<TableCell>
													<DaysLeft subscription={subscription} />
												</TableCell>
												<TableCell>
													<div className="flex flex-wrap items-center gap-1.5">
														<ManualSubscriptionStatusBadge
															entitled={subscription.entitled}
														/>
														{subscription.inGrace ? (
															<ManualSubscriptionGraceBadge />
														) : null}
													</div>
												</TableCell>
												<TableCell>
													<p className="font-mono text-sm tabular-nums">
														{formatWholeNumber(subscription.paymentsCount)}
													</p>
													<p className="whitespace-nowrap text-muted-foreground text-xs">
														Last: {formatAdminDate(subscription.lastPaymentAt)}
													</p>
												</TableCell>
												<TableCell className="whitespace-nowrap text-muted-foreground text-sm">
													{formatAdminDateTime(subscription.createdAt)}
												</TableCell>
												<TableCell>
													<ManualSubscriptionActions
														subscription={subscription}
														onDetails={() =>
															setDetailSubscriptionId(subscription.id)
														}
													/>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						)}

						<div className="flex items-center justify-between gap-3 border-t pt-4">
							<p className="text-muted-foreground text-sm">
								{formatWholeNumber(result.total)} subscriptions
							</p>
							<div className="flex items-center gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={page <= 1 || subscriptionsQuery.isFetching}
									onClick={() => setPage((current) => current - 1)}
								>
									<ChevronLeftIcon
										className="rtl:rotate-180"
										data-icon="inline-start"
										aria-hidden="true"
									/>
									Previous
								</Button>
								<span className="text-muted-foreground text-sm tabular-nums">
									{page} / {totalPages}
								</span>
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={page >= totalPages || subscriptionsQuery.isFetching}
									onClick={() => setPage((current) => current + 1)}
								>
									Next
									<ChevronRightIcon
										className="rtl:rotate-180"
										data-icon="inline-end"
										aria-hidden="true"
									/>
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			) : null}

			<ManualSubscriptionDetailSheet
				subscriptionId={detailSubscriptionId}
				open={detailSubscriptionId !== null}
				onOpenChange={(open) => {
					if (!open) {
						setDetailSubscriptionId(null);
					}
				}}
			/>
		</div>
	);
}

function DaysLeft({ subscription }: { subscription: AdminManualSubscription }) {
	if (!subscription.entitled) {
		return <span className="text-muted-foreground text-sm">Ended</span>;
	}

	if (subscription.inGrace) {
		return (
			<div className="whitespace-nowrap">
				<p className="font-medium text-amber-700 text-sm dark:text-amber-400">
					Due now
				</p>
				<p className="text-muted-foreground text-xs">
					Access ends {formatAdminDate(subscription.accessEndsAt)}
				</p>
			</div>
		);
	}

	const days = daysUntil(subscription.currentPeriodEnd);
	if (days <= 0) {
		return (
			<span className="font-medium text-destructive text-sm">Due now</span>
		);
	}

	return (
		<span className="whitespace-nowrap text-sm">
			{days} {days === 1 ? "day" : "days"}
		</span>
	);
}

type SubscriptionActionDialog = "renew" | "end" | null;

function ManualSubscriptionActions({
	subscription,
	onDetails,
}: {
	subscription: AdminManualSubscription;
	onDetails: () => void;
}) {
	const [activeDialog, setActiveDialog] =
		useState<SubscriptionActionDialog>(null);
	const canManage = useAdminPermission({ billing: ["manage"] });
	const ownerLabel = subscription.organization?.name ?? subscription.user.name;

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						title="Subscription actions"
					>
						<EllipsisIcon aria-hidden="true" />
						<span className="sr-only">Actions for {ownerLabel}</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-52">
					<DropdownMenuLabel className="truncate">
						{ownerLabel}
					</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem onSelect={onDetails}>
							<EyeIcon />
							Details & payments
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<Link
								to="/offline-billing/$subscriptionId/receipt"
								params={{ subscriptionId: subscription.id }}
								target="_blank"
								rel="noopener noreferrer"
							>
								<PrinterIcon />
								Print receipt
							</Link>
						</DropdownMenuItem>
						{canManage ? (
							<DropdownMenuItem onSelect={() => setActiveDialog("renew")}>
								<CalendarPlusIcon />
								Renew
							</DropdownMenuItem>
						) : null}
					</DropdownMenuGroup>
					{canManage && subscription.entitled ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								variant="destructive"
								onSelect={() => setActiveDialog("end")}
							>
								<OctagonXIcon />
								End now
							</DropdownMenuItem>
						</>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>

			{canManage ? (
				<>
					<RenewManualSubscriptionDialog
						subscription={{
							id: subscription.id,
							plan: subscription.plan,
							interval: subscription.interval,
							tierCredits: subscription.tierCredits,
							currentPeriodEnd: subscription.currentPeriodEnd,
							entitled: subscription.entitled,
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
