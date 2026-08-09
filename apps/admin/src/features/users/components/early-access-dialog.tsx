import { Loader2Icon, ShieldCheckIcon, ShieldOffIcon } from "lucide-react";
import type { MouseEvent } from "react";
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
import { useSetUserAccessMutation } from "@/features/users/api/users.mutations";
import { isApiClientError } from "@/lib/api-client";

type EarlyAccessDialogProps = {
	user: AdminUserSummary;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function EarlyAccessDialog({
	user,
	open,
	onOpenChange,
}: EarlyAccessDialogProps) {
	const mutation = useSetUserAccessMutation();
	const nextGrantedState = !user.earlyAccess;

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && mutation.isPending) {
			return;
		}
		onOpenChange(nextOpen);
	}

	async function handleConfirm(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault();

		try {
			await mutation.mutateAsync({
				userId: user.id,
				granted: nextGrantedState,
			});
			toast.success(
				nextGrantedState
					? `Beta access granted to ${user.name}.`
					: `Beta access revoked for ${user.name}.`,
			);
			onOpenChange(false);
		} catch (error) {
			toast.error(
				isApiClientError(error)
					? error.message
					: nextGrantedState
						? "Beta access could not be granted. Please try again."
						: "Beta access could not be revoked. Please try again.",
			);
		}
	}

	return (
		<AlertDialog open={open} onOpenChange={handleOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogMedia>
						{nextGrantedState ? (
							<ShieldCheckIcon aria-hidden="true" />
						) : (
							<ShieldOffIcon aria-hidden="true" />
						)}
					</AlertDialogMedia>
					<AlertDialogTitle>
						{nextGrantedState ? "Grant beta access?" : "Revoke beta access?"}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{nextGrantedState
							? `${user.name} will be able to create, generate, publish, and purchase in Wandit.`
							: `${user.name} will return to the early-access preview. Existing content will remain available.`}
					</AlertDialogDescription>
				</AlertDialogHeader>

				<AlertDialogFooter>
					<AlertDialogCancel disabled={mutation.isPending}>
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						variant={nextGrantedState ? "default" : "destructive"}
						disabled={mutation.isPending}
						onClick={handleConfirm}
					>
						{mutation.isPending ? (
							<Loader2Icon
								data-icon="inline-start"
								className="animate-spin"
								aria-hidden="true"
							/>
						) : nextGrantedState ? (
							<ShieldCheckIcon data-icon="inline-start" aria-hidden="true" />
						) : (
							<ShieldOffIcon data-icon="inline-start" aria-hidden="true" />
						)}
						{mutation.isPending
							? nextGrantedState
								? "Granting…"
								: "Revoking…"
							: nextGrantedState
								? "Grant access"
								: "Revoke access"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
