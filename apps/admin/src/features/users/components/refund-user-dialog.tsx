/**
 * Confirm dialog of the "Refund last payment" action in the users table.
 * Reads the refund preview, then refunds the last Stripe plan payment and cancels the Stripe plan.
 * UserRowActions renders it. It calls useUserRefundPreviewQuery and useRefundUserMutation.
 */
import { ADMIN_PERMISSION_REQUIRED_ERROR_CODE } from "@wandit/contracts";
import { Loader2Icon, RotateCcwIcon } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { toast } from "sonner";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AdminUserSummary } from "@/features/users/api/users.dto";
import { useRefundUserMutation } from "@/features/users/api/users.mutations";
import { useUserRefundPreviewQuery } from "@/features/users/api/users.queries";
import { titleCase } from "@/features/users/components/detail/user-detail-helpers";
import {
	formatAdminDate,
	formatMinorAmount,
} from "@/features/users/lib/formatters";
import { isApiClientError } from "@/lib/api-client";

type RefundUserDialogProps = {
	user: AdminUserSummary;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** Mounts its body only while open, so the preview reads Stripe only then. */
export function RefundUserDialog(props: RefundUserDialogProps) {
	if (!props.open) {
		return null;
	}

	return <OpenRefundUserDialog {...props} />;
}

function OpenRefundUserDialog({ user, onOpenChange }: RefundUserDialogProps) {
	const preview = useUserRefundPreviewQuery(user.id);
	const mutation = useRefundUserMutation();
	const payment = preview.data?.payment ?? null;
	const remainingMinor = payment
		? payment.amountPaidMinor - payment.amountRefundedMinor
		: 0;
	const nothingLeftToDo =
		payment !== null && remainingMinor <= 0 && payment.subscriptionCanceled;
	const canConfirm = payment !== null && !nothingLeftToDo;

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && mutation.isPending) {
			return;
		}
		onOpenChange(nextOpen);
	}

	async function confirmRefund(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault();
		if (!payment) {
			return;
		}

		try {
			const result = await mutation.mutateAsync({
				userId: user.id,
				stripeInvoiceId: payment.stripeInvoiceId,
			});
			toast.success(
				result.refund
					? `Refund of ${formatMinorAmount(result.refund.amountMinor, result.refund.currency)} sent to Stripe (status: ${result.refund.status ?? "unknown"}). The subscription is canceled.`
					: "The payment was refunded already. The subscription is canceled.",
			);
			onOpenChange(false);
		} catch (error) {
			toast.error(
				errorText(error, "The refund could not be made. Please try again."),
			);
		}
	}

	let body: ReactNode;
	if (preview.isPending) {
		body = (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
				Loading the last Stripe payment…
			</p>
		);
	} else if (preview.isError) {
		body = (
			<p className="text-destructive text-sm">
				{errorText(
					preview.error,
					"The last payment could not be loaded. Please try again.",
				)}
			</p>
		);
	} else if (preview.data.paidOffline) {
		// SlickPay and offline payments have no refund API. The server sends no payment then.
		body = (
			<p className="text-sm">
				This user pays through SlickPay or offline. Refund the payment in the
				SlickPay dashboard, or by hand for an offline payment. Then end the
				subscription on the user page.
			</p>
		);
	} else if (!payment) {
		body = (
			<p className="text-sm">No Stripe plan payment found for this user.</p>
		);
	} else {
		body = (
			<div className="flex flex-col gap-4">
				<dl className="grid grid-cols-2 gap-x-6 gap-y-4">
					<RefundDetail
						label="Amount paid"
						value={formatMinorAmount(payment.amountPaidMinor, payment.currency)}
					/>
					<RefundDetail
						label="Paid on"
						value={formatAdminDate(payment.paidAt)}
					/>
					<RefundDetail
						label="Plan"
						value={`${titleCase(payment.plan)}, ${payment.interval === "month" ? "monthly" : "yearly"}`}
					/>
					{payment.amountRefundedMinor > 0 ? (
						<RefundDetail
							label="Refunded already"
							value={formatMinorAmount(
								payment.amountRefundedMinor,
								payment.currency,
							)}
						/>
					) : null}
				</dl>
				{nothingLeftToDo ? (
					<p className="text-sm">
						This payment is refunded in full and the Stripe subscription is
						canceled. Nothing is left to do.
					</p>
				) : (
					<p className="text-sm">
						{remainingMinor > 0
							? `Stripe refunds the full remaining amount of ${formatMinorAmount(remainingMinor, payment.currency)}.`
							: "This payment is refunded in full already."}{" "}
						{payment.subscriptionCanceled
							? "The Stripe subscription is canceled already."
							: "The Stripe subscription is canceled now, so Stripe does not charge again."}{" "}
						The plan credits from this payment are removed when Stripe confirms.
					</p>
				)}
			</div>
		);
	}

	return (
		<AlertDialog open onOpenChange={handleOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogMedia>
						<RotateCcwIcon aria-hidden="true" />
					</AlertDialogMedia>
					<AlertDialogTitle>Refund the last payment?</AlertDialogTitle>
					<AlertDialogDescription>
						Last Stripe plan payment of {user.name}.
					</AlertDialogDescription>
				</AlertDialogHeader>

				{body}

				<AlertDialogFooter>
					<AlertDialogCancel disabled={mutation.isPending}>
						Close
					</AlertDialogCancel>
					{canConfirm ? (
						<AlertDialogAction
							variant="destructive"
							disabled={mutation.isPending}
							onClick={confirmRefund}
						>
							{mutation.isPending ? (
								<Loader2Icon
									data-icon="inline-start"
									className="animate-spin"
									aria-hidden="true"
								/>
							) : (
								<RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
							)}
							{mutation.isPending
								? "Refunding…"
								: remainingMinor > 0
									? "Refund and cancel"
									: "Cancel subscription"}
						</AlertDialogAction>
					) : null}
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function RefundDetail({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0">
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd className="mt-1 truncate font-medium text-sm">{value}</dd>
		</div>
	);
}

/** Same error text as the ban dialog: a permission error asks for a reload, an API error shows its message. */
function errorText(error: unknown, fallback: string): string {
	if (!isApiClientError(error)) {
		return fallback;
	}

	return error.code === ADMIN_PERMISSION_REQUIRED_ERROR_CODE
		? "Your permissions changed. Reload the page to refresh your access."
		: error.message;
}
