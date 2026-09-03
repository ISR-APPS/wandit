import { AlertTriangleIcon, Loader2Icon, UsersRoundIcon } from "lucide-react";
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
	AlertDialogMedia,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
	AdminWorkspaceRole,
	OrganizationMember,
} from "@/features/organizations/api/organizations.dto";
import { useSetOrganizationMemberRoleMutation } from "@/features/organizations/api/organizations.mutations";
import {
	formatAdminDate,
	formatWholeNumber,
} from "@/features/users/lib/formatters";
import { isApiClientError } from "@/lib/api-client";
import { formatCreditAmount } from "@/lib/credit-format";

const WORKSPACE_ROLES: AdminWorkspaceRole[] = ["owner", "admin", "member"];

type PendingRoleChange = {
	member: OrganizationMember;
	nextRole: AdminWorkspaceRole;
};

/**
 * Primary role for the select: Better Auth stores comma-joined multi-role
 * strings, so containment (not equality) decides.
 */
function primaryRole(role: string): AdminWorkspaceRole {
	const roles = role.split(",").map((value) => value.trim().toLowerCase());

	if (roles.includes("owner")) {
		return "owner";
	}

	if (roles.includes("admin")) {
		return "admin";
	}

	return "member";
}

export function OrgMembersCard({
	organizationId,
	members,
	defaultMemberMonthlyCreditLimit,
}: {
	organizationId: string;
	members: OrganizationMember[];
	defaultMemberMonthlyCreditLimit: number | null;
}) {
	const [pending, setPending] = useState<PendingRoleChange | null>(null);
	const mutation = useSetOrganizationMemberRoleMutation();
	const canManage = useAdminPermission({ organizations: ["manage"] });

	useEffect(() => {
		if (!canManage && pending !== null) {
			setPending(null);
		}
	}, [canManage, pending]);

	const hasOwner = members.some((row) => primaryRole(row.role) === "owner");
	const demotingLastOwner =
		pending !== null &&
		pending.nextRole !== "owner" &&
		primaryRole(pending.member.role) === "owner" &&
		members.filter((row) => primaryRole(row.role) === "owner").length === 1;

	async function confirmRoleChange() {
		if (!pending || !canManage) {
			return;
		}

		try {
			await mutation.mutateAsync({
				organizationId,
				userId: pending.member.userId,
				role: pending.nextRole,
			});
			toast.success(
				`${pending.member.name} is now ${pending.nextRole} of this workspace.`,
			);
			setPending(null);
		} catch (error) {
			toast.error(
				isApiClientError(error)
					? error.message
					: "The member role could not be updated. Please try again.",
			);
		}
	}

	return (
		<Card className="shadow-none">
			<CardHeader>
				<CardTitle>Members</CardTitle>
				<CardDescription>
					Roles, monthly credit limits, and spend this calendar month.
					{defaultMemberMonthlyCreditLimit !== null
						? ` Default member limit: ${formatWholeNumber(defaultMemberMonthlyCreditLimit)} credits/month.`
						: " No default member limit is set."}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{!hasOwner ? (
					<div
						role="alert"
						className="mb-4 flex items-start gap-3 rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-destructive text-sm"
					>
						<AlertTriangleIcon className="mt-0.5 shrink-0" aria-hidden="true" />
						<p>
							This workspace has no owner. Promote a member to owner so the team
							can manage billing again.
						</p>
					</div>
				) : null}

				{members.length === 0 ? (
					<div className="flex items-center gap-3 rounded-md border border-dashed px-4 py-6 text-muted-foreground text-sm">
						<UsersRoundIcon aria-hidden="true" />
						No members. This organization is stray — repair or ignore it.
					</div>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Member</TableHead>
								<TableHead>Role</TableHead>
								<TableHead>Joined</TableHead>
								<TableHead className="text-end">Monthly limit</TableHead>
								<TableHead className="text-end">Spent this month</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{members.map((row) => (
								<TableRow key={row.userId}>
									<TableCell>
										<div className="flex min-w-0 flex-col">
											<span className="truncate font-medium">{row.name}</span>
											<span className="truncate text-muted-foreground text-xs">
												{row.email}
											</span>
										</div>
									</TableCell>
									<TableCell>
										<Select
											value={primaryRole(row.role)}
											disabled={mutation.isPending || !canManage}
											onValueChange={(value) => {
												const nextRole = value as AdminWorkspaceRole;

												if (nextRole !== primaryRole(row.role)) {
													setPending({ member: row, nextRole });
												}
											}}
										>
											<SelectTrigger
												size="sm"
												className="w-28"
												aria-label={`Change role for ${row.name}`}
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{WORKSPACE_ROLES.map((role) => (
													<SelectItem key={role} value={role}>
														<span className="capitalize">{role}</span>
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{formatAdminDate(row.joinedAt)}
									</TableCell>
									<TableCell className="text-end font-mono text-sm tabular-nums">
										{row.monthlyCreditLimit === null
											? "—"
											: formatWholeNumber(row.monthlyCreditLimit)}
									</TableCell>
									<TableCell className="text-end font-mono text-sm tabular-nums">
										{formatCreditAmount(row.spentThisMonth)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>

			<AlertDialog
				open={canManage && pending !== null}
				onOpenChange={(open) => {
					if (!open && !mutation.isPending) {
						setPending(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogMedia>
							<AlertTriangleIcon aria-hidden="true" />
						</AlertDialogMedia>
						<AlertDialogTitle>
							Make {pending?.member.name} {pending?.nextRole}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							{demotingLastOwner
								? "This demotes the workspace's ONLY owner — nobody will be able to manage billing until you promote another member to owner."
								: "This writes the member row directly, bypassing the normal in-app role rules. Use it to repair broken teams."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={mutation.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							variant={demotingLastOwner ? "destructive" : "default"}
							disabled={mutation.isPending}
							onClick={(event) => {
								event.preventDefault();
								void confirmRoleChange();
							}}
						>
							{mutation.isPending ? (
								<Loader2Icon
									data-icon="inline-start"
									className="animate-spin"
									aria-hidden="true"
								/>
							) : null}
							{mutation.isPending ? "Applying…" : "Change role"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Card>
	);
}
