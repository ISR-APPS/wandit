import type { AdminView } from "@wandit/contracts";
import { Loader2Icon, PanelsTopLeftIcon } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { AdminUserDetail } from "@/features/users/api/users.dto";
import { useSetAdminViewsMutation } from "@/features/users/api/users.mutations";
import { AdminViewChecklist } from "@/features/users/components/admin-view-checklist";
import {
	getInitialAdminViews,
	hasAtLeastOneAdminView,
} from "@/features/users/lib/admin-view-options";
import { isApiClientError } from "@/lib/api-client";

type AdminViewsDialogProps = {
	user: AdminUserDetail;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function AdminViewsDialog({
	user,
	open,
	onOpenChange,
}: AdminViewsDialogProps) {
	const [views, setViews] = useState<AdminView[]>(() =>
		getInitialAdminViews(user.role, user.adminViews),
	);
	const mutation = useSetAdminViewsMutation();
	const hasValidViews = hasAtLeastOneAdminView(views);

	useEffect(() => {
		if (open) {
			setViews(getInitialAdminViews(user.role, user.adminViews));
		}
	}, [open, user.adminViews, user.role]);

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && mutation.isPending) {
			return;
		}
		onOpenChange(nextOpen);
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!hasValidViews) {
			return;
		}

		try {
			await mutation.mutateAsync({ userId: user.id, views });
			toast.success(`Admin views updated for ${user.name}.`);
			handleOpenChange(false);
		} catch (error) {
			toast.error(
				isApiClientError(error)
					? error.message
					: "The admin views could not be updated. Please try again.",
			);
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				<form onSubmit={handleSubmit} className="flex flex-col gap-6">
					<DialogHeader>
						<div className="flex items-center gap-3">
							<div className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
								<PanelsTopLeftIcon aria-hidden="true" />
							</div>
							<div className="flex min-w-0 flex-col gap-1">
								<DialogTitle>Admin views</DialogTitle>
								<DialogDescription className="truncate">
									Update dashboard access for {user.name}.
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>

					<div className="flex flex-col gap-2">
						<AdminViewChecklist
							value={views}
							onChange={setViews}
							disabled={mutation.isPending}
							idPrefix={`admin-views-${user.id}`}
						/>
						{!hasValidViews ? (
							<p className="text-destructive text-sm">
								Select at least one admin view.
							</p>
						) : null}
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => handleOpenChange(false)}
							disabled={mutation.isPending}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={mutation.isPending || !hasValidViews}
						>
							{mutation.isPending ? (
								<Loader2Icon
									data-icon="inline-start"
									className="animate-spin"
									aria-hidden="true"
								/>
							) : (
								<PanelsTopLeftIcon
									data-icon="inline-start"
									aria-hidden="true"
								/>
							)}
							{mutation.isPending ? "Saving…" : "Save views"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
