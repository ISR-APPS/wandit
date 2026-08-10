import { Loader2Icon, ShieldCheckIcon } from "lucide-react";
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
import type { BulkSetUserAccessResult } from "@/features/users/api/users.dto";
import { useBulkSetAccessMutation } from "@/features/users/api/users.mutations";
import { isApiClientError } from "@/lib/api-client";

type BulkGrantAccessDialogProps = {
	userIds: string[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
};

function BulkGrantAccessDialog({
	userIds,
	open,
	onOpenChange,
	onSuccess,
}: BulkGrantAccessDialogProps) {
	const mutation = useBulkSetAccessMutation();

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && mutation.isPending) {
			return;
		}

		onOpenChange(nextOpen);
	}

	async function handleConfirm(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault();

		try {
			const result = await mutation.mutateAsync({
				userIds,
				granted: true,
			});
			showResultToast(result);
			onSuccess();
			onOpenChange(false);
		} catch (error) {
			toast.error(
				isApiClientError(error)
					? error.message
					: "Access could not be granted. Please try again.",
			);
		}
	}

	return (
		<AlertDialog open={open} onOpenChange={handleOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogMedia>
						<ShieldCheckIcon aria-hidden="true" />
					</AlertDialogMedia>
					<AlertDialogTitle>
						Grant access to {formatUserCount(userIds.length)}?
					</AlertDialogTitle>
					<AlertDialogDescription>
						The selected users will be able to create, generate, publish, and
						purchase in Wandit. No credits will be added.
					</AlertDialogDescription>
				</AlertDialogHeader>

				<AlertDialogFooter>
					<AlertDialogCancel disabled={mutation.isPending}>
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						disabled={mutation.isPending}
						onClick={handleConfirm}
					>
						{mutation.isPending ? (
							<Loader2Icon
								data-icon="inline-start"
								className="animate-spin"
								aria-hidden="true"
							/>
						) : (
							<ShieldCheckIcon data-icon="inline-start" aria-hidden="true" />
						)}
						{mutation.isPending ? "Granting…" : "Grant access"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function showResultToast(result: BulkSetUserAccessResult) {
	if (result.failed === 0 && result.skipped === 0) {
		toast.success(`Access granted to ${formatUserCount(result.updated)}.`);
		return;
	}

	if (result.updated === 0 && result.skipped === 0) {
		toast.error(
			`Access could not be granted to ${formatUserCount(result.failed)}.`,
		);
		return;
	}

	const messages: string[] = [];

	if (result.updated > 0) {
		messages.push(`Access granted to ${formatUserCount(result.updated)}.`);
	}

	if (result.skipped > 0) {
		messages.push(
			`${formatUserCount(result.skipped)} skipped (already granted or admin).`,
		);
	}

	if (result.failed > 0) {
		messages.push(`${formatUserCount(result.failed)} failed.`);
	}

	toast.warning(messages.join(" "));
}

function formatUserCount(count: number) {
	return `${count} ${count === 1 ? "user" : "users"}`;
}

export type { BulkGrantAccessDialogProps };
export { BulkGrantAccessDialog };
