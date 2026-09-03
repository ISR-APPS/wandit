import { Link } from "@tanstack/react-router";
import {
	CalendarXIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	EllipsisIcon,
	EyeIcon,
	HandCoinsIcon,
	MessageSquareTextIcon,
	PhoneCallIcon,
	PrinterIcon,
	RefreshCwIcon,
	SearchIcon,
	XCircleIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
	AdminManualRequest,
	AdminManualRequestStatusFilter,
} from "@/features/offline-billing/api/offline-billing.dto";
import { useUpdateManualRequestMutation } from "@/features/offline-billing/api/offline-billing.mutations";
import { useManualRequestsQuery } from "@/features/offline-billing/api/offline-billing.queries";
import {
	MANUAL_COUNTRY_LABELS,
	MANUAL_PAYMENT_METHOD_LABELS,
} from "@/features/offline-billing/lib/offline-billing";
import {
	formatAdminDate,
	formatAdminDateTime,
	formatWholeNumber,
} from "@/features/users/lib/formatters";
import { isApiClientError } from "@/lib/api-client";
import { EndManualSubscriptionDialog } from "./end-manual-subscription-dialog";
import { GrantManualSubscriptionDialog } from "./grant-manual-subscription-dialog";
import { ManualRequestDetailSheet } from "./manual-request-detail-sheet";
import { ManualRequestNoteDialog } from "./manual-request-note-dialog";
import { ManualRequestStatusBadge } from "./offline-billing-badges";
import { RenewManualSubscriptionDialog } from "./renew-manual-subscription-dialog";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 25;

const STATUS_LABELS: Record<AdminManualRequestStatusFilter, string> = {
	open: "Open requests",
	all: "All statuses",
	pending: "Pending",
	contacted: "Contacted",
	approved: "Approved",
	rejected: "Rejected",
	canceled: "Canceled",
};

export function ManualRequestsTable() {
	const [page, setPage] = useState(1);
	const [status, setStatus] = useState<AdminManualRequestStatusFilter>("open");
	const [searchValue, setSearchValue] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [detailRequestId, setDetailRequestId] = useState<string | null>(null);

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

	const requestsQuery = useManualRequestsQuery({
		page,
		pageSize: PAGE_SIZE,
		status,
		q: debouncedQuery || undefined,
	});
	const result = requestsQuery.data;
	const totalPages = result
		? Math.max(1, Math.ceil(result.total / PAGE_SIZE))
		: 1;

	useEffect(() => {
		if (result && !requestsQuery.isFetching && page > totalPages) {
			setPage(totalPages);
		}
	}, [page, requestsQuery.isFetching, result, totalPages]);

	return (
		<div className="space-y-4">
			{requestsQuery.isError && result ? (
				<div
					role="alert"
					className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-destructive text-sm"
				>
					<span>
						These requests could not be refreshed and may be out of date.
					</span>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => void requestsQuery.refetch()}
					>
						<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
						Retry
					</Button>
				</div>
			) : null}

			{requestsQuery.isPending ? (
				<Card className="shadow-none">
					<CardContent className="flex flex-col gap-3 py-6">
						<Skeleton className="h-9 w-full max-w-xl" />
						{Array.from({ length: 6 }, (_, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
							<Skeleton key={index} className="h-14 w-full" />
						))}
					</CardContent>
				</Card>
			) : requestsQuery.isError && !result ? (
				<Empty className="min-h-[420px] border bg-background">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<HandCoinsIcon aria-hidden="true" />
						</EmptyMedia>
						<EmptyTitle>Offline requests could not be loaded</EmptyTitle>
						<EmptyDescription>
							The server did not respond. Retry the request to restore the
							queue.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button type="button" onClick={() => void requestsQuery.refetch()}>
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
									placeholder="Search contact, phone, company, or email"
									className="ps-9"
									aria-label="Search offline requests"
									maxLength={200}
								/>
							</div>
							<Select
								value={status}
								onValueChange={(value) =>
									setStatus(value as AdminManualRequestStatusFilter)
								}
							>
								<SelectTrigger
									className="w-44"
									aria-label="Filter request status"
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
									{status === "open" && !debouncedQuery
										? "No open offline requests"
										: "No requests match the current filters"}
								</p>
								<p className="mt-1 text-muted-foreground text-sm">
									Use the status filter to review historical requests.
								</p>
							</div>
						) : (
							<div className="overflow-x-auto">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Contact</TableHead>
											<TableHead>User</TableHead>
											<TableHead>Workspace</TableHead>
											<TableHead>Plan</TableHead>
											<TableHead>Location & method</TableHead>
											<TableHead>Created</TableHead>
											<TableHead>Status</TableHead>
											<TableHead className="w-12">
												<span className="sr-only">Actions</span>
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{result.items.map((request) => (
											<TableRow key={request.id}>
												<TableCell>
													<p className="font-medium">{request.fullName}</p>
													<a
														href={`tel:${request.phone}`}
														className="text-muted-foreground text-xs hover:underline"
													>
														{request.phone}
													</a>
													{request.company ? (
														<p className="max-w-44 truncate text-muted-foreground text-xs">
															{request.company}
														</p>
													) : null}
												</TableCell>
												<TableCell>
													<Link
														to="/users/$userId"
														params={{ userId: request.user.id }}
														className="block max-w-48 hover:underline"
													>
														<span className="block truncate font-medium text-sm">
															{request.user.name}
														</span>
														<span className="block truncate text-muted-foreground text-xs">
															{request.user.email}
														</span>
													</Link>
												</TableCell>
												<TableCell>
													{request.organization ? (
														<Link
															to="/organizations/$organizationId"
															params={{
																organizationId: request.organization.id,
															}}
															className="block max-w-40 truncate hover:underline"
														>
															{request.organization.name}
														</Link>
													) : (
														<span className="text-muted-foreground text-sm">
															Personal
														</span>
													)}
												</TableCell>
												<TableCell>
													<p className="text-sm capitalize">
														{request.plan} ·{" "}
														{request.tierCredits.toLocaleString("en-US")} ·{" "}
														{request.interval}
													</p>
													{request.currentSubscription ? (
														<Badge variant="outline" className="mt-1">
															Current{" "}
															{request.currentSubscription.provider === "manual"
																? "offline"
																: "Stripe"}{" "}
															plan
														</Badge>
													) : null}
												</TableCell>
												<TableCell>
													<p className="text-sm">
														{MANUAL_COUNTRY_LABELS[request.country] ??
															request.country}
														{request.city ? ` · ${request.city}` : ""}
													</p>
													<p className="text-muted-foreground text-xs">
														{request.preferredPaymentMethod
															? MANUAL_PAYMENT_METHOD_LABELS[
																	request.preferredPaymentMethod
																]
															: "No method selected"}
													</p>
												</TableCell>
												<TableCell className="whitespace-nowrap text-muted-foreground text-sm">
													{formatAdminDateTime(request.createdAt)}
												</TableCell>
												<TableCell>
													<ManualRequestStatusBadge status={request.status} />
													{request.handledAt ? (
														<p className="mt-1 whitespace-nowrap text-muted-foreground text-xs">
															{formatAdminDate(request.handledAt)}
														</p>
													) : null}
												</TableCell>
												<TableCell>
													<ManualRequestActions
														request={request}
														onDetails={() => setDetailRequestId(request.id)}
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
								{formatWholeNumber(result.total)} requests
							</p>
							<div className="flex items-center gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={page <= 1 || requestsQuery.isFetching}
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
									disabled={page >= totalPages || requestsQuery.isFetching}
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

			<ManualRequestDetailSheet
				requestId={detailRequestId}
				open={detailRequestId !== null}
				onOpenChange={(open) => {
					if (!open) {
						setDetailRequestId(null);
					}
				}}
			/>
		</div>
	);
}

type RequestActionDialog = "grant" | "renew" | "end" | "note" | "reject" | null;

function ManualRequestActions({
	request,
	onDetails,
}: {
	request: AdminManualRequest;
	onDetails: () => void;
}) {
	const [activeDialog, setActiveDialog] = useState<RequestActionDialog>(null);
	const updateMutation = useUpdateManualRequestMutation();
	const canManage = useAdminPermission({ billing: ["manage"] });
	const canAct = request.status === "pending" || request.status === "contacted";
	const currentManualSubscription =
		request.currentSubscription?.provider === "manual"
			? request.currentSubscription
			: null;

	async function markContacted() {
		try {
			await updateMutation.mutateAsync({
				requestId: request.id,
				body: { status: "contacted" },
			});
			toast.success(`${request.fullName} marked as contacted.`);
		} catch (error) {
			toast.error(
				isApiClientError(error)
					? error.message
					: "The request could not be updated. Please try again.",
			);
		}
	}

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						title="Request actions"
					>
						<EllipsisIcon aria-hidden="true" />
						<span className="sr-only">Actions for {request.fullName}</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56">
					<DropdownMenuLabel className="truncate">
						{request.fullName}
					</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem onSelect={onDetails}>
							<EyeIcon />
							View details
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							{request.subscriptionId ? (
								<Link
									to="/offline-billing/$subscriptionId/receipt"
									params={{ subscriptionId: request.subscriptionId }}
									target="_blank"
									rel="noopener noreferrer"
								>
									<PrinterIcon />
									Print receipt
								</Link>
							) : (
								<Link
									to="/offline-billing/requests/$requestId/receipt"
									params={{ requestId: request.id }}
									target="_blank"
									rel="noopener noreferrer"
								>
									<PrinterIcon />
									Print receipt
								</Link>
							)}
						</DropdownMenuItem>
						{canManage && request.status === "pending" ? (
							<DropdownMenuItem
								disabled={updateMutation.isPending}
								onSelect={() => void markContacted()}
							>
								<PhoneCallIcon />
								Mark contacted
							</DropdownMenuItem>
						) : null}
						{canManage && canAct && currentManualSubscription ? (
							<DropdownMenuItem onSelect={() => setActiveDialog("renew")}>
								<HandCoinsIcon />
								Renew current subscription
							</DropdownMenuItem>
						) : null}
						{canManage && canAct && currentManualSubscription ? (
							<DropdownMenuItem onSelect={() => setActiveDialog("end")}>
								<CalendarXIcon />
								End current subscription…
							</DropdownMenuItem>
						) : null}
						{canManage && canAct && !request.currentSubscription ? (
							<DropdownMenuItem onSelect={() => setActiveDialog("grant")}>
								<HandCoinsIcon />
								Approve & grant
							</DropdownMenuItem>
						) : null}
						{canManage ? (
							<DropdownMenuItem onSelect={() => setActiveDialog("note")}>
								<MessageSquareTextIcon />
								Edit note
							</DropdownMenuItem>
						) : null}
					</DropdownMenuGroup>
					{canManage && canAct ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								variant="destructive"
								onSelect={() => setActiveDialog("reject")}
							>
								<XCircleIcon />
								Reject
							</DropdownMenuItem>
						</>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>

			{canManage ? (
				<GrantManualSubscriptionDialog
					open={activeDialog === "grant"}
					onOpenChange={(open) => setActiveDialog(open ? "grant" : null)}
					prefill={{
						user: request.user,
						organization: request.organization ?? undefined,
						plan: request.plan,
						tierCredits: request.tierCredits,
						interval: request.interval,
						requestId: request.id,
						adminNotes: request.adminNotes,
					}}
				/>
			) : null}
			{canManage && currentManualSubscription ? (
				<RenewManualSubscriptionDialog
					subscription={{
						id: currentManualSubscription.id,
						plan: currentManualSubscription.plan,
						interval: currentManualSubscription.interval,
						tierCredits: currentManualSubscription.tierCredits,
						currentPeriodEnd: currentManualSubscription.currentPeriodEnd,
						entitled:
							currentManualSubscription.status === "active" ||
							currentManualSubscription.status === "trialing",
						ownerLabel: request.organization?.name ?? request.fullName,
					}}
					requested={{
						plan: request.plan,
						interval: request.interval,
						tierCredits: request.tierCredits,
					}}
					requestId={request.id}
					open={activeDialog === "renew"}
					onOpenChange={(open) => setActiveDialog(open ? "renew" : null)}
				/>
			) : null}
			{canManage && currentManualSubscription ? (
				<EndManualSubscriptionDialog
					subscriptionId={currentManualSubscription.id}
					ownerLabel={request.organization?.name ?? request.fullName}
					open={activeDialog === "end"}
					onOpenChange={(open) => setActiveDialog(open ? "end" : null)}
				/>
			) : null}
			{canManage ? (
				<>
					<ManualRequestNoteDialog
						request={request}
						mode="note"
						open={activeDialog === "note"}
						onOpenChange={(open) => setActiveDialog(open ? "note" : null)}
					/>
					<ManualRequestNoteDialog
						request={request}
						mode="reject"
						open={activeDialog === "reject"}
						onOpenChange={(open) => setActiveDialog(open ? "reject" : null)}
					/>
				</>
			) : null}
		</>
	);
}
