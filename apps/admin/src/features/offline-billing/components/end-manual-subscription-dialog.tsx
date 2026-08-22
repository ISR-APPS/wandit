import { Loader2Icon, OctagonXIcon } from "lucide-react";
import { type MouseEvent, useState } from "react";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useEndManualSubscriptionMutation } from "@/features/offline-billing/api/offline-billing.mutations";
import { trimmedOptional } from "@/features/offline-billing/lib/offline-billing";
import { isApiClientError } from "@/lib/api-client";

type EndManualSubscriptionDialogProps = {
	subscriptionId: string;
	ownerLabel?: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function EndManualSubscriptionDialog(
	props: EndManualSubscriptionDialogProps,
) {
	if (!props.open) {
		return null;
	}

	return <OpenEndManualSubscriptionDialog {...props} />;
}

function OpenEndManualSubscriptionDialog({
	subscriptionId,
	ownerLabel,
	onOpenChange,
}: EndManualSubscriptionDialogProps) {
	const [reason, setReason] = useState("");
	const mutation = useEndManualSubscriptionMutation();
	const reasonIsValid = reason.trim().length <= 500;

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && mutation.isPending) {
			return;
		}
		onOpenChange(nextOpen);
	}

	async function confirmEnd(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault();
		if (!reasonIsValid) {
			return;
		}

		try {
			await mutation.mutateAsync({
				subscriptionId,
				body: { reason: trimmedOptional(reason) },
			});
			toast.success(
				`Offline subscription ended${ownerLabel ? ` for ${ownerLabel}` : ""}.`,
			);
			onOpenChange(false);
		} catch (error) {
			toast.error(
				isApiClientError(error)
					? error.message
					: "The offline subscription could not be ended. Please try again.",
			);
		}
	}

	return (
		<AlertDialog open onOpenChange={handleOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogMedia>
						<OctagonXIcon aria-hidden="true" />
					</AlertDialogMedia>
					<AlertDialogTitle>End this subscription now?</AlertDialogTitle>
					<AlertDialogDescription>
						The subscription becomes canceled immediately. Pending refill slots
						are removed, and unused plan credits may expire.
					</AlertDialogDescription>
				</AlertDialogHeader>

				<Field>
					<FieldLabel htmlFor="manual-end-reason">
						Reason
						<span className="font-normal text-muted-foreground">
							{" "}
							(optional)
						</span>
					</FieldLabel>
					<Textarea
						id="manual-end-reason"
						value={reason}
						onChange={(event) => setReason(event.target.value)}
						disabled={mutation.isPending}
						maxLength={500}
						placeholder="Customer request, payment reversed…"
					/>
				</Field>

				<AlertDialogFooter>
					<AlertDialogCancel disabled={mutation.isPending}>
						Keep active
					</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						disabled={mutation.isPending || !reasonIsValid}
						onClick={confirmEnd}
					>
						{mutation.isPending ? (
							<Loader2Icon className="animate-spin" aria-hidden="true" />
						) : null}
						{mutation.isPending ? "Ending…" : "End subscription"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
