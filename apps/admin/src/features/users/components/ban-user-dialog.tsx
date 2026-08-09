import { BanIcon, Loader2Icon, ShieldCheckIcon } from "lucide-react";
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
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { AdminUserSummary } from "@/features/users/api/users.dto";
import { useSetUserBannedMutation } from "@/features/users/api/users.mutations";
import { isApiClientError } from "@/lib/api-client";

type BanUserDialogProps = {
	user: AdminUserSummary;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function BanUserDialog({
	user,
	open,
	onOpenChange,
}: BanUserDialogProps) {
	const [reason, setReason] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const mutation = useSetUserBannedMutation();
	const nextBannedState = !user.banned;
	const reasonIsValid = !nextBannedState || reason.trim().length >= 3;

	function resetForm() {
		setReason("");
		setSubmitted(false);
	}

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && mutation.isPending) {
			return;
		}
		if (!nextOpen) {
			resetForm();
		}
		onOpenChange(nextOpen);
	}

	async function handleConfirm(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault();
		setSubmitted(true);

		if (!reasonIsValid) {
			return;
		}

		try {
			await mutation.mutateAsync({
				userId: user.id,
				banned: nextBannedState,
				reason: reason.trim() || undefined,
			});
			toast.success(
				nextBannedState
					? `${user.name} has been banned.`
					: `${user.name}'s access has been restored.`,
			);
			resetForm();
			onOpenChange(false);
		} catch (error) {
			toast.error(
				isApiClientError(error)
					? error.message
					: nextBannedState
						? "The user could not be banned. Please try again."
						: "Access could not be restored. Please try again.",
			);
		}
	}

	return (
		<AlertDialog open={open} onOpenChange={handleOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogMedia>
						{nextBannedState ? (
							<BanIcon aria-hidden="true" />
						) : (
							<ShieldCheckIcon aria-hidden="true" />
						)}
					</AlertDialogMedia>
					<AlertDialogTitle>
						{nextBannedState ? "Ban this user?" : "Restore user access?"}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{nextBannedState
							? `${user.name} will lose access to Wandit until an administrator restores it.`
							: `${user.name} will be able to sign in and use Wandit again.`}
					</AlertDialogDescription>
				</AlertDialogHeader>

				{nextBannedState ? (
					<Field data-invalid={submitted && !reasonIsValid}>
						<FieldLabel htmlFor="ban-user-reason">Reason</FieldLabel>
						<Textarea
							id="ban-user-reason"
							value={reason}
							onChange={(event) => setReason(event.target.value)}
							placeholder="Abuse, payment dispute, policy violation…"
							aria-invalid={submitted && !reasonIsValid}
							maxLength={240}
						/>
						<FieldDescription>
							This note is visible to administrators only.
						</FieldDescription>
						<FieldError>
							{submitted && !reasonIsValid
								? "Add a short reason before banning this user."
								: null}
						</FieldError>
					</Field>
				) : null}

				<AlertDialogFooter>
					<AlertDialogCancel disabled={mutation.isPending}>
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						variant={nextBannedState ? "destructive" : "default"}
						disabled={mutation.isPending}
						onClick={handleConfirm}
					>
						{mutation.isPending ? (
							<Loader2Icon
								data-icon="inline-start"
								className="animate-spin"
								aria-hidden="true"
							/>
						) : nextBannedState ? (
							<BanIcon data-icon="inline-start" aria-hidden="true" />
						) : (
							<ShieldCheckIcon data-icon="inline-start" aria-hidden="true" />
						)}
						{mutation.isPending
							? "Saving…"
							: nextBannedState
								? "Ban user"
								: "Restore access"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
