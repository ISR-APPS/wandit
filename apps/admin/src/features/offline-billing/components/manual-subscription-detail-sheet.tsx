import { Link } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";
import type { PropsWithChildren } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useManualSubscriptionQuery } from "@/features/offline-billing/api/offline-billing.queries";
import {
	formatManualPaymentAmount,
	MANUAL_PAYMENT_METHOD_LABELS,
} from "@/features/offline-billing/lib/offline-billing";
import {
	formatAdminDate,
	formatAdminDateTime,
} from "@/features/users/lib/formatters";
import { isApiClientError } from "@/lib/api-client";

import { ManualSubscriptionStatusBadge } from "./offline-billing-badges";

type ManualSubscriptionDetailSheetProps = {
	subscriptionId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function ManualSubscriptionDetailSheet(
	props: ManualSubscriptionDetailSheetProps,
) {
	return (
		<ManualSubscriptionDetailSheetContent
			key={props.subscriptionId ?? "no-subscription"}
			{...props}
		/>
	);
}

function ManualSubscriptionDetailSheetContent({
	subscriptionId,
	open,
	onOpenChange,
}: ManualSubscriptionDetailSheetProps) {
	const subscriptionQuery = useManualSubscriptionQuery(
		subscriptionId ?? undefined,
		open,
	);
	const subscription = subscriptionQuery.data;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full gap-0 sm:max-w-4xl">
				<SheetHeader className="border-b p-5 pe-12">
					<SheetTitle>Offline subscription details</SheetTitle>
					<SheetDescription>
						Funded periods and append-only payment history.
					</SheetDescription>
				</SheetHeader>

				{subscriptionQuery.isPending ? (
					<div className="space-y-4 p-5">
						<Skeleton className="h-8 w-36" />
						{Array.from({ length: 7 }, (_, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static sheet skeletons
							<Skeleton key={index} className="h-14 w-full" />
						))}
					</div>
				) : subscriptionQuery.isError || !subscription ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
						<p className="font-medium">Subscription could not be loaded</p>
						<p className="max-w-sm text-muted-foreground text-sm">
							{isApiClientError(subscriptionQuery.error)
								? subscriptionQuery.error.message
								: "Retry the request to restore this subscription."}
						</p>
						<Button
							type="button"
							onClick={() => void subscriptionQuery.refetch()}
						>
							<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
							Retry
						</Button>
					</div>
				) : (
					<div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<p className="font-semibold text-lg">
									{subscription.organization?.name ?? subscription.user.name}
								</p>
								<p className="text-muted-foreground text-sm">
									Created {formatAdminDateTime(subscription.createdAt)}
								</p>
							</div>
							<div className="flex items-center gap-2">
								<Badge variant="outline">Paid offline</Badge>
								<ManualSubscriptionStatusBadge
									entitled={subscription.entitled}
								/>
							</div>
						</div>

						<section className="space-y-3">
							<h3 className="font-medium text-sm">Subscription</h3>
							<dl className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-3">
								<DetailItem label="Owner">
									{subscription.organization ? (
										<Link
											to="/organizations/$organizationId"
											params={{ organizationId: subscription.organization.id }}
											className="hover:underline"
										>
											{subscription.organization.name}
										</Link>
									) : (
										<Link
											to="/users/$userId"
											params={{ userId: subscription.user.id }}
											className="hover:underline"
										>
											{subscription.user.name}
										</Link>
									)}
								</DetailItem>
								<DetailItem label="Billing contact">
									{subscription.user.name} · {subscription.user.email}
								</DetailItem>
								<DetailItem label="Plan">
									<span className="capitalize">{subscription.plan}</span> ·{" "}
									{subscription.tierCredits.toLocaleString("en-US")} credits
								</DetailItem>
								<DetailItem label="Interval">
									{subscription.interval === "month" ? "Monthly" : "Yearly"}
								</DetailItem>
								<DetailItem label="Current period">
									{formatAdminDate(subscription.currentPeriodStart)} →{" "}
									{formatAdminDate(subscription.currentPeriodEnd)}
								</DetailItem>
								<DetailItem label="Provider status">
									{subscription.status}
								</DetailItem>
								<DetailItem label="Payments">
									{subscription.paymentsCount.toLocaleString("en-US")}
								</DetailItem>
								<DetailItem label="Last payment">
									{formatAdminDateTime(subscription.lastPaymentAt)}
								</DetailItem>
								<DetailItem label="Subscription ID">
									<span className="font-mono text-xs">{subscription.id}</span>
								</DetailItem>
							</dl>
						</section>

						<section className="space-y-3">
							<h3 className="font-medium text-sm">Payments</h3>
							{subscription.payments.length === 0 ? (
								<p className="rounded-lg border p-6 text-center text-muted-foreground text-sm">
									No payments are recorded for this subscription.
								</p>
							) : (
								<div className="overflow-x-auto rounded-lg border">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Payment</TableHead>
												<TableHead>Method</TableHead>
												<TableHead>Funded period</TableHead>
												<TableHead>Recorded</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{subscription.payments.map((payment) => (
												<TableRow key={payment.id}>
													<TableCell>
														<p className="font-medium">
															{formatManualPaymentAmount(
																payment.amountMinor,
																payment.currency,
															)}
														</p>
														<p className="text-muted-foreground text-xs capitalize">
															{payment.kind}
															{payment.reference
																? ` · ${payment.reference}`
																: ""}
														</p>
														{payment.note ? (
															<p className="mt-1 max-w-72 whitespace-pre-wrap text-muted-foreground text-xs">
																{payment.note}
															</p>
														) : null}
													</TableCell>
													<TableCell>
														{MANUAL_PAYMENT_METHOD_LABELS[payment.method]}
													</TableCell>
													<TableCell className="whitespace-nowrap text-muted-foreground text-sm">
														{formatAdminDate(payment.periodStart)} →{" "}
														{formatAdminDate(payment.periodEnd)}
													</TableCell>
													<TableCell className="text-muted-foreground text-sm">
														{formatAdminDateTime(payment.createdAt)}
														{payment.recordedBy ? (
															<span className="block text-xs">
																by {payment.recordedBy.name}
															</span>
														) : null}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							)}
						</section>

						{subscription.request ? (
							<section className="space-y-2 rounded-lg border bg-muted/20 p-4">
								<h3 className="font-medium text-sm">Original request</h3>
								<p className="text-muted-foreground text-sm">
									{subscription.request.fullName} · {subscription.request.phone}{" "}
									· submitted{" "}
									{formatAdminDateTime(subscription.request.createdAt)}
								</p>
								{subscription.request.notes ? (
									<p className="whitespace-pre-wrap text-sm">
										{subscription.request.notes}
									</p>
								) : null}
							</section>
						) : null}
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}

function DetailItem({ label, children }: PropsWithChildren<{ label: string }>) {
	return (
		<div className="min-w-0">
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd className="mt-1 break-words font-medium text-sm">{children}</dd>
		</div>
	);
}
