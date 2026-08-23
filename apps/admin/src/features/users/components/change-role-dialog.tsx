import { Loader2Icon, ShieldCheckIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
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
		description:
			"Admin dashboard with limited permissions (see docs/features/admin-permissions.md).",
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
	const mutation = useChangeUserRoleMutation();
	const selectedRole = ROLE_OPTIONS.find((option) => option.value === role);

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && mutation.isPending) {
			return;
		}
		// The dialog stays mounted per row, so an abandoned selection has to be
		// dropped on close — this Root has no trigger, so it never reopens itself.
		if (!nextOpen) {
			setRole(user.role);
		}
		onOpenChange(nextOpen);
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (role === user.role) {
			onOpenChange(false);
			return;
		}

		try {
			await mutation.mutateAsync({ userId: user.id, role });
			toast.success(`${user.name} is now ${selectedRole?.label ?? role}.`);
			onOpenChange(false);
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
			<DialogContent>
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
							disabled={mutation.isPending || role === user.role}
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
