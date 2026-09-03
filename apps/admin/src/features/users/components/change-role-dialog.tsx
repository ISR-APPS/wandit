import type { AdminView } from "@wandit/contracts";
import { Loader2Icon, ShieldCheckIcon } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
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
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type {
	AdminUserSummary,
	UserRole,
} from "@/features/users/api/users.dto";
import { useChangeUserRoleMutation } from "@/features/users/api/users.mutations";
import { useUserQuery } from "@/features/users/api/users.queries";
import { AdminViewChecklist } from "@/features/users/components/admin-view-checklist";
import {
	getInitialAdminViews,
	hasAtLeastOneAdminView,
} from "@/features/users/lib/admin-view-options";
import { isApiClientError } from "@/lib/api-client";

const ROLE_OPTIONS: readonly {
	value: UserRole;
	label: string;
	description: string;
}[] = [
	{
		value: "user",
		label: "User",
		description: "Standard product access.",
	},
	{
		value: "support",
		label: "Support",
		description: "Admin dashboard access limited to the selected views.",
	},
	{
		value: "admin",
		label: "Admin",
		description: "Platform management access.",
	},
];

type ChangeRoleDialogProps = {
	user: AdminUserSummary;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function ChangeRoleDialog({
	user,
	open,
	onOpenChange,
}: ChangeRoleDialogProps) {
	const [role, setRole] = useState<UserRole>(user.role);
	const [views, setViews] = useState<AdminView[]>(() =>
		getInitialAdminViews(user.role, null),
	);
	const initializedForOpen = useRef(false);
	const appliedStoredViews = useRef(false);
	const mutation = useChangeUserRoleMutation();
	// List rows only contain summaries. Fetch the detail while this dialog is
	// open so an existing support account starts with its stored grant set.
	const detailQuery = useUserQuery(open ? user.id : undefined);
	const selectedRole = ROLE_OPTIONS.find((option) => option.value === role);
	const isLoadingStoredViews =
		user.role === "support" && detailQuery.isFetching;
	const cannotLoadStoredViews = user.role === "support" && detailQuery.isError;
	const hasValidViews = role !== "support" || hasAtLeastOneAdminView(views);

	useEffect(() => {
		if (!open) {
			initializedForOpen.current = false;
			appliedStoredViews.current = false;
			return;
		}

		if (!initializedForOpen.current) {
			initializedForOpen.current = true;
			setRole(user.role);
			setViews(getInitialAdminViews(user.role, null));
		}
	}, [open, user.role]);

	useEffect(() => {
		if (
			!open ||
			user.role !== "support" ||
			detailQuery.isFetching ||
			detailQuery.isError ||
			!detailQuery.data ||
			appliedStoredViews.current
		) {
			return;
		}

		appliedStoredViews.current = true;
		setViews(getInitialAdminViews(user.role, detailQuery.data.adminViews));
	}, [
		detailQuery.data,
		detailQuery.isError,
		detailQuery.isFetching,
		open,
		user.role,
	]);

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && mutation.isPending) {
			return;
		}
		onOpenChange(nextOpen);
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (!hasValidViews || (role === "support" && cannotLoadStoredViews)) {
			return;
		}

		if (role === user.role && role !== "support") {
			handleOpenChange(false);
			return;
		}

		try {
			await mutation.mutateAsync({
				userId: user.id,
				role,
				...(role === "support" ? { views } : {}),
			});
			toast.success(`${user.name} is now ${selectedRole?.label ?? role}.`);
			handleOpenChange(false);
		} catch (error) {
			toast.error(
				isApiClientError(error)
					? error.message
					: "The user role could not be changed. Please try again.",
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
								<ShieldCheckIcon aria-hidden="true" />
							</div>
							<div className="flex min-w-0 flex-col gap-1">
								<DialogTitle>Change role</DialogTitle>
								<DialogDescription className="truncate">
									Update access for {user.name}.
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>

					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="user-role">Role</FieldLabel>
							<Select
								value={role}
								onValueChange={(value) => setRole(value as UserRole)}
								disabled={mutation.isPending}
							>
								<SelectTrigger id="user-role" className="w-full">
									<SelectValue placeholder="Select a role" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										<SelectLabel>Platform role</SelectLabel>
										{ROLE_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
							<FieldDescription>
								{selectedRole?.description ??
									"Choose the user's platform permissions."}
							</FieldDescription>
						</Field>
					</FieldGroup>

					{role === "support" ? (
						<div className="flex flex-col gap-2">
							<AdminViewChecklist
								value={views}
								onChange={setViews}
								disabled={mutation.isPending || isLoadingStoredViews}
								idPrefix={`change-role-${user.id}`}
							/>
							{isLoadingStoredViews ? (
								<p className="text-muted-foreground text-sm">
									Loading current admin views…
								</p>
							) : null}
							{cannotLoadStoredViews ? (
								<p className="text-destructive text-sm">
									Current admin views could not be loaded. Close and try again.
								</p>
							) : null}
							{!hasAtLeastOneAdminView(views) ? (
								<p className="text-destructive text-sm">
									Select at least one admin view.
								</p>
							) : null}
						</div>
					) : null}

					{isRoleDemotion(user.role, role) ? (
						<p className="rounded-md border bg-muted/40 p-3 text-muted-foreground text-sm">
							Confirm that another admin will retain access before changing this
							role.
						</p>
					) : null}

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
							disabled={
								mutation.isPending ||
								!hasValidViews ||
								(role === "support" &&
									(isLoadingStoredViews || cannotLoadStoredViews)) ||
								(role === user.role && role !== "support")
							}
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
							{mutation.isPending ? "Saving…" : "Save role"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

const ROLE_PRIVILEGE: Record<UserRole, number> = {
	user: 0,
	support: 1,
	admin: 2,
};

function isRoleDemotion(currentRole: UserRole, nextRole: UserRole): boolean {
	return (
		currentRole !== "user" &&
		ROLE_PRIVILEGE[nextRole] < ROLE_PRIVILEGE[currentRole]
	);
}
