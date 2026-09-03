import { Link } from "@tanstack/react-router";
import { PrinterIcon, RefreshCwIcon } from "lucide-react";
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
import { useManualRequestQuery } from "@/features/offline-billing/api/offline-billing.queries";
import {
	MANUAL_COUNTRY_LABELS,
	MANUAL_PAYMENT_METHOD_LABELS,
} from "@/features/offline-billing/lib/offline-billing";
import {
	formatAdminDate,
	formatAdminDateTime,
} from "@/features/users/lib/formatters";
import { isApiClientError } from "@/lib/api-client";

import { ManualRequestStatusBadge } from "./offline-billing-badges";

type ManualRequestDetailSheetProps = {
	requestId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function ManualRequestDetailSheet(props: ManualRequestDetailSheetProps) {
	return (
		<ManualRequestDetailSheetContent
			key={props.requestId ?? "no-request"}
			{...props}
		/>
	);
}

function ManualRequestDetailSheetContent({
	requestId,
	open,
	onOpenChange,
}: ManualRequestDetailSheetProps) {
	const requestQuery = useManualRequestQuery(requestId ?? undefined, open);
	const request = requestQuery.data;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full gap-0 sm:max-w-2xl">
				<SheetHeader className="border-b p-5 pe-12">
					<SheetTitle>Offline payment request</SheetTitle>
					<SheetDescription>
						Contact, plan, and internal follow-up information.
					</SheetDescription>
				</SheetHeader>

				{requestQuery.isPending ? (
					<div className="space-y-4 p-5">
						<Skeleton className="h-8 w-36" />
						{Array.from({ length: 8 }, (_, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static sheet skeletons
							<Skeleton key={index} className="h-14 w-full" />
						))}
					</div>
				) : requestQuery.isError || !request ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
						<p className="font-medium">Request could not be loaded</p>
						<p className="max-w-sm text-muted-foreground text-sm">
							{isApiClientError(requestQuery.error)
								? requestQuery.error.message
								: "Retry the request to restore its details."}
						</p>
						<Button type="button" onClick={() => void requestQuery.refetch()}>
							<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
							Retry
						</Button>
					</div>
				) : (
					<div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<p className="font-semibold text-lg">{request.fullName}</p>
								<p className="text-muted-foreground text-sm">
									Submitted {formatAdminDateTime(request.createdAt)}
								</p>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<Button asChild variant="outline" size="sm">
									{request.subscriptionId ? (
										<Link
											to="/offline-billing/$subscriptionId/receipt"
											params={{ subscriptionId: request.subscriptionId }}
											target="_blank"
											rel="noopener noreferrer"
										>
											<PrinterIcon
												data-icon="inline-start"
												aria-hidden="true"
											/>
											Print receipt
										</Link>
									) : (
										<Link
											to="/offline-billing/requests/$requestId/receipt"
											params={{ requestId: request.id }}
											target="_blank"
											rel="noopener noreferrer"
										>
											<PrinterIcon
												data-icon="inline-start"
												aria-hidden="true"
											/>
											Print receipt
										</Link>
									)}
								</Button>
								<ManualRequestStatusBadge status={request.status} />
							</div>
						</div>

						<DetailSection title="Contact">
							<DetailItem label="Phone">
								<a className="hover:underline" href={`tel:${request.phone}`}>
									{request.phone}
								</a>
							</DetailItem>
							<DetailItem label="Company">{request.company ?? "—"}</DetailItem>
							<DetailItem label="Account">
								<Link
									to="/users/$userId"
									params={{ userId: request.user.id }}
									className="hover:underline"
								>
									{request.user.name} · {request.user.email}
								</Link>
							</DetailItem>
							<DetailItem label="Workspace">
								{request.organization ? (
									<Link
										to="/organizations/$organizationId"
										params={{ organizationId: request.organization.id }}
										className="hover:underline"
									>
										{request.organization.name}
									</Link>
								) : (
									"Personal account"
								)}
							</DetailItem>
						</DetailSection>

						<DetailSection title="Requested plan">
							<DetailItem label="Plan">
								<span className="capitalize">{request.plan}</span>
							</DetailItem>
							<DetailItem label="Credit tier">
								{request.tierCredits.toLocaleString("en-US")} credits / month
							</DetailItem>
							<DetailItem label="Interval">
								{request.interval === "month" ? "Monthly" : "Yearly"}
							</DetailItem>
							<DetailItem label="Preferred method">
								{request.preferredPaymentMethod
									? MANUAL_PAYMENT_METHOD_LABELS[request.preferredPaymentMethod]
									: "No preference"}
							</DetailItem>
						</DetailSection>

						<DetailSection title="Location">
							<DetailItem label="Country">
								{MANUAL_COUNTRY_LABELS[request.country] ?? request.country}
							</DetailItem>
							<DetailItem label="City">{request.city ?? "—"}</DetailItem>
						</DetailSection>

						<NoteBlock label="Customer notes" value={request.notes} />
						<NoteBlock label="Admin notes" value={request.adminNotes} />

						<DetailSection title="Handling">
							<DetailItem label="Request ID">
								<span className="font-mono text-xs">{request.id}</span>
							</DetailItem>
							<DetailItem label="Handled by">
								{request.handledBy
									? `${request.handledBy.name} · ${request.handledBy.email}`
									: "—"}
							</DetailItem>
							<DetailItem label="Handled at">
								{formatAdminDateTime(request.handledAt)}
							</DetailItem>
							<DetailItem label="Last updated">
								{formatAdminDateTime(request.updatedAt)}
							</DetailItem>
							<DetailItem label="Linked subscription">
								{request.subscriptionId ?? "—"}
							</DetailItem>
						</DetailSection>

						{request.currentSubscription ? (
							<div className="rounded-lg border bg-muted/30 p-4">
								<div className="flex flex-wrap items-center gap-2">
									<p className="font-medium text-sm">Current subscription</p>
									<Badge variant="outline">
										{request.currentSubscription.provider === "manual"
											? "Paid offline"
											: "Stripe"}
									</Badge>
								</div>
								<p className="mt-2 text-muted-foreground text-sm">
									{request.currentSubscription.plan} ·{" "}
									{request.currentSubscription.tierCredits.toLocaleString(
										"en-US",
									)}{" "}
									credits · ends{" "}
									{formatAdminDate(
										request.currentSubscription.currentPeriodEnd,
									)}
								</p>
								<p className="mt-1 text-muted-foreground text-xs">
									{request.currentSubscription.status} ·{" "}
									{request.currentSubscription.interval} ·{" "}
									{request.currentSubscription.cancelAtPeriodEnd
										? "cancels at period end"
										: "not scheduled to cancel"}
								</p>
								<p className="mt-1 break-all font-mono text-muted-foreground text-xs">
									{request.currentSubscription.id}
								</p>
							</div>
						) : null}
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}

function DetailSection({
	title,
	children,
}: PropsWithChildren<{ title: string }>) {
	return (
		<section className="space-y-3">
			<h3 className="font-medium text-sm">{title}</h3>
			<dl className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
				{children}
			</dl>
		</section>
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

function NoteBlock({ label, value }: { label: string; value: string | null }) {
	return (
		<section className="space-y-2">
			<h3 className="font-medium text-sm">{label}</h3>
			<p className="whitespace-pre-wrap rounded-lg border bg-muted/20 p-4 text-sm">
				{value || "No note recorded."}
			</p>
		</section>
	);
}
