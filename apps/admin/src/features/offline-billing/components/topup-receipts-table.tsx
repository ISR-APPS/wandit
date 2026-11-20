/**
 * Lists the wallet receipts of provider "offline" or "slickpay", with the action "Reverse top-up".
 * Shown in the "Top-ups" tab of the offline billing page.
 * Reads useTopupReceiptsQuery and calls useReverseTopupMutation behind a confirm dialog.
 */
import { Link } from "@tanstack/react-router";
import type { TopupReceiptProvider } from "@wandit/contracts";
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	RefreshCwIcon,
	Undo2Icon,
	WalletCardsIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
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
import type { AdminTopupReceipt } from "@/features/offline-billing/api/offline-billing.dto";
import { useReverseTopupMutation } from "@/features/offline-billing/api/offline-billing.mutations";
import { useTopupReceiptsQuery } from "@/features/offline-billing/api/offline-billing.queries";
import {
	formatManualPaymentAmount,
	MANUAL_PAYMENT_METHOD_LABELS,
} from "@/features/offline-billing/lib/offline-billing";
import { formatAdminDateTime, formatWholeNumber } from "@/features/users";
import { isApiClientError } from "@/lib/api-client";
import { formatCreditAmount } from "@/lib/credit-format";

const PAGE_SIZE = 25;

/** Stripe receipts are left out: a card top-up is refunded in the Stripe Dashboard. */
type ReversibleProvider = Extract<TopupReceiptProvider, "offline" | "slickpay">;

const PROVIDER_LABELS: Record<ReversibleProvider, string> = {
	offline: "Offline top-ups",
	slickpay: "SlickPay top-ups",
};

/** Opens on the offline receipts. Only an admin with billing manage sees the reverse action. */
export function TopupReceiptsTable() {
	const [page, setPage] = useState(1);
	const [provider, setProvider] = useState<ReversibleProvider>("offline");
	const [reverseReceipt, setReverseReceipt] =
		useState<AdminTopupReceipt | null>(null);
	const canManage = useAdminPermission({ billing: ["manage"] });
	const receiptsQuery = useTopupReceiptsQuery({
		page,
		pageSize: PAGE_SIZE,
		provider,
	});
	const result = receiptsQuery.data;
	const totalPages = result
		? Math.max(1, Math.ceil(result.total / PAGE_SIZE))
		: 1;

	useEffect(() => {
		if (result && !receiptsQuery.isFetching && page > totalPages) {
			setPage(totalPages);
		}
	}, [page, receiptsQuery.isFetching, result, totalPages]);

	if (receiptsQuery.isPending) {
		return (
			<Card className="shadow-none">
				<CardContent className="flex flex-col gap-3 py-6">
					{Array.from({ length: 6 }, (_, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
						<Skeleton key={index} className="h-14 w-full" />
					))}
				</CardContent>
			</Card>
		);
	}

	if (!result) {
		return (
			<Empty className="min-h-[420px] border bg-background">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<WalletCardsIcon aria-hidden="true" />
					</EmptyMedia>
					<EmptyTitle>Top-ups could not be loaded</EmptyTitle>
					<EmptyDescription>
						The server did not respond. Retry to load the list.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button type="button" onClick={() => void receiptsQuery.refetch()}>
						<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
						Retry
					</Button>
				</EmptyContent>
			</Empty>
		);
	}

	return (
		<Card className="shadow-none">
			<CardContent className="flex flex-col gap-4 pt-6">
				<Select
					value={provider}
					onValueChange={(value) => {
						setProvider(value === "slickpay" ? "slickpay" : "offline");
						setPage(1);
					}}
				>
					<SelectTrigger className="w-48" aria-label="Filter top-up provider">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{Object.entries(PROVIDER_LABELS).map(([value, label]) => (
							<SelectItem key={value} value={value}>
								{label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{result.items.length === 0 ? (
					<p className="py-10 text-center font-medium text-sm">
						No {PROVIDER_LABELS[provider].toLowerCase()} yet
					</p>
				) : (
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Paid</TableHead>
									<TableHead>Wallet</TableHead>
									<TableHead>Payment</TableHead>
									<TableHead className="text-end">Credits</TableHead>
									<TableHead>Recorded by</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="w-12">
										<span className="sr-only">Actions</span>
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{result.items.map((receipt) => (
									<TableRow key={receipt.id}>
										<TableCell className="whitespace-nowrap text-muted-foreground text-sm">
											{formatAdminDateTime(receipt.paidAt)}
										</TableCell>
										<TableCell>
											<ReceiptOwner receipt={receipt} />
										</TableCell>
										<TableCell>
											<p className="font-mono text-sm tabular-nums">
												{formatManualPaymentAmount(
													receipt.amountMinor,
													receipt.currency,
												)}
											</p>
											<p className="max-w-48 truncate text-muted-foreground text-xs">
												{receipt.method
													? MANUAL_PAYMENT_METHOD_LABELS[receipt.method]
													: "—"}
												{receipt.reference ? ` · ${receipt.reference}` : ""}
											</p>
										</TableCell>
										<TableCell className="text-end font-mono text-sm tabular-nums">
											{receipt.credits === null
												? "—"
												: formatCreditAmount(receipt.credits)}
										</TableCell>
										<TableCell className="text-muted-foreground text-sm">
											{receipt.recordedBy?.name ?? "—"}
										</TableCell>
										<TableCell>
											{receipt.reversedAt ? (
												<Badge variant="destructive">
													Reversed {formatAdminDateTime(receipt.reversedAt)}
												</Badge>
											) : (
												<Badge variant="secondary">Credited</Badge>
											)}
										</TableCell>
										<TableCell>
											{/* A reversed receipt has no credits left to take back. */}
											{canManage && !receipt.reversedAt ? (
												<Button
													type="button"
													variant="ghost"
													size="icon-sm"
													title="Reverse top-up"
													onClick={() => setReverseReceipt(receipt)}
												>
													<Undo2Icon aria-hidden="true" />
													<span className="sr-only">Reverse top-up</span>
												</Button>
											) : null}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}

				<div className="flex items-center justify-between gap-3 border-t pt-4">
					<p className="text-muted-foreground text-sm">
						{formatWholeNumber(result.total)} top-ups
					</p>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={page <= 1 || receiptsQuery.isFetching}
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
							disabled={page >= totalPages || receiptsQuery.isFetching}
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

			{canManage ? (
				<ReverseTopupDialog
					receipt={reverseReceipt}
					onClose={() => setReverseReceipt(null)}
				/>
			) : null}
		</Card>
	);
}

function ReceiptOwner({ receipt }: { receipt: AdminTopupReceipt }) {
	if (receipt.organization) {
		return (
			<Link
				to="/organizations/$organizationId"
				params={{ organizationId: receipt.organization.id }}
				className="block max-w-48 truncate text-sm hover:underline"
			>
				Team: {receipt.organization.name}
			</Link>
		);
	}

	return (
		<Link
			to="/users/$userId"
			params={{ userId: receipt.user.id }}
			className="block max-w-48 hover:underline"
		>
			<span className="block truncate font-medium text-sm">
				{receipt.user.name}
			</span>
			<span className="block truncate text-muted-foreground text-xs">
				{receipt.user.email}
			</span>
		</Link>
	);
}

/** Confirm step of "Reverse top-up". The API takes back all credits of the receipt. */
function ReverseTopupDialog({
	receipt,
	onClose,
}: {
	/** The receipt to reverse. Null closes the dialog. */
	receipt: AdminTopupReceipt | null;
	onClose: () => void;
}) {
	const mutation = useReverseTopupMutation();
	const ownerLabel = receipt
		? (receipt.organization?.name ?? receipt.user.name)
		: "";

	async function confirmReverse(target: AdminTopupReceipt) {
		try {
			await mutation.mutateAsync(target.id);
			toast.success(`Top-up reversed for ${ownerLabel}.`);
			onClose();
		} catch (error) {
			toast.error(
				isApiClientError(error)
					? error.message
					: "The top-up could not be reversed. Please try again.",
			);
		}
	}

	return (
		<AlertDialog
			open={receipt !== null}
			onOpenChange={(next) => {
				if (!next && !mutation.isPending) {
					onClose();
				}
			}}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Reverse this top-up?</AlertDialogTitle>
					<AlertDialogDescription>
						{receipt?.credits === null || receipt === null
							? "The API removes the credits of this receipt"
							: `The API removes ${formatCreditAmount(receipt.credits)} credits`}{" "}
						from the wallet of {ownerLabel}. The balance can go below zero when
						the credits are already spent. You cannot undo this action.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={mutation.isPending}>
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						disabled={mutation.isPending}
						onClick={(event) => {
							// Keep the dialog open until the API answers.
							event.preventDefault();
							if (receipt) {
								void confirmReverse(receipt);
							}
						}}
					>
						{mutation.isPending ? "Reversing…" : "Reverse top-up"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
