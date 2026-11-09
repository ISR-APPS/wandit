/**
 * The members table of the organization detail page, with the staff role select.
 * OrganizationDetailPage renders it. The select writes through useSetOrganizationMemberRoleMutation.
 * In a personal workspace, only the personal owner can hold the owner role, and that user keeps it.
 */
import { adminWorkspaceRoles } from "@wandit/contracts";
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

type PendingRoleChange = {
	member: OrganizationMember;
	nextRole: AdminWorkspaceRole;
};

// Design 2.1: the `member` key shows as "Editor", like the web app. The API value stays `member`.
const roleLabels = {
	owner: "Owner",
	admin: "Admin",
	member: "Editor",
	viewer: "Viewer",
} satisfies Record<AdminWorkspaceRole, string>;

/**
 * Primary role for the select: Better Auth stores comma-joined multi-role
 * strings, so containment (not equality) decides. `adminWorkspaceRoles` lists
 * the roles highest first. Null means no known role: the select then shows the
 * raw string, so staff never overwrite an unknown role by mistake.
 */
export function primaryRole(role: string): AdminWorkspaceRole | null {
	const roles = role.split(",").map((value) => value.trim().toLowerCase());

	return adminWorkspaceRoles.find((known) => roles.includes(known)) ?? null;
}

export function OrgMembersCard({
	organizationId,
	members,
	defaultMemberMonthlyCreditLimit,
	isPersonal,
	personalOwnerUserId,
}: {
	organizationId: string;
	members: OrganizationMember[];
	defaultMemberMonthlyCreditLimit: number | null;
	/** True for a user's personal workspace. That user is its only owner, and the API refuses a second one. */
	isPersonal: boolean;
	/** The user id of that only owner. Null for a team, or when an older API leaves it out. */
	personalOwnerUserId: string | null;
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
				`${pending.member.name} now has the ${roleLabels[pending.nextRole]} role in this workspace.`,
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
					{isPersonal
						? " Personal workspace: only its personal owner has the owner role. Staff cannot give it to another member or remove it."
						: null}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{!hasOwner ? (
					<div
						role="alert"
						className="mb-4 flex items-start gap-3 rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-destructive text-sm"
					>
						<AlertTriangleIcon className="mt-0.5 shrink-0" aria-hidden="true" />
						{/* The API restores a missing personal owner row. Staff repair a changed role with the select. */}
						<p>
							{isPersonal
								? "This personal workspace has no owner role. If the personal owner row has another role, give it the Owner role again. The API restores a missing owner row when the owner next loads the workspace list."
								: "This workspace has no owner. Promote a member to owner so the team can manage billing again."}
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
							{members.map((row) => {
								// The API accepts only `owner` for the personal owner, and never `owner` for another member.
								const isPersonalOwnerRow =
									isPersonal && row.userId === personalOwnerUserId;

								return (
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
											{/* "" shows an unknown raw role as the placeholder. The personal owner row stays
											    locked while it has the owner role, because it can have no other role. */}
											<Select
												value={primaryRole(row.role) ?? ""}
												disabled={
													mutation.isPending ||
													!canManage ||
													(isPersonalOwnerRow &&
														primaryRole(row.role) === "owner")
												}
												onValueChange={(value) => {
													// SAFETY: every SelectItem value below comes from adminWorkspaceRoles.
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
													<SelectValue placeholder={row.role} />
												</SelectTrigger>
												<SelectContent>
													{adminWorkspaceRoles.map((role) => (
														<SelectItem
															key={role}
															value={role}
															disabled={
																isPersonalOwnerRow
																	? role !== "owner"
																	: isPersonal && role === "owner"
															}
														>
															{roleLabels[role]}
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
								);
							})}
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
							Make {pending?.member.name}{" "}
							{pending ? roleLabels[pending.nextRole] : null}?
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
