import { Link } from "@tanstack/react-router";
import { AlertCircleIcon, ArrowLeftIcon, UserRoundXIcon } from "lucide-react";
import { type PropsWithChildren, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { useSession } from "@/features/auth/lib/session";
import { useUserQuery } from "@/features/users/api/users.queries";
import { BanUserDialog } from "@/features/users/components/ban-user-dialog";
import { ChangeRoleDialog } from "@/features/users/components/change-role-dialog";
import { UserActivityPanel } from "@/features/users/components/detail/user-activity-panel";
import { UserDetailHeader } from "@/features/users/components/detail/user-detail-header";
import { UserDetailSkeleton } from "@/features/users/components/detail/user-detail-skeleton";
import { UserMetrics } from "@/features/users/components/detail/user-metrics";
import { UserSubscriptionCard } from "@/features/users/components/detail/user-subscription-card";
import { UserWorkspacesCard } from "@/features/users/components/detail/user-workspaces-card";
import { EarlyAccessDialog } from "@/features/users/components/early-access-dialog";
import { GrantCreditsDialog } from "@/features/users/components/grant-credits-dialog";
import { isApiClientError } from "@/lib/api-client";

type UserDetailPageProps = {
	userId: string;
};

type OpenDialog = "credits" | "access" | "role" | "ban" | null;

export function UserDetailPage({ userId }: UserDetailPageProps) {
	const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
	const userQuery = useUserQuery(userId);
	const { data: session } = useSession();

	if (userQuery.isLoading) {
		return (
			<UserDetailContainer>
				<UserDetailSkeleton />
			</UserDetailContainer>
		);
	}

	if (userQuery.isError) {
		// The AdminGuard answers 404 for missing users (and for non-admin
		// sessions, which the route guard already filters out).
		const isMissing =
			isApiClientError(userQuery.error) && userQuery.error.status === 404;

		if (isMissing) {
			return (
				<UserDetailContainer>
					<MissingUserState />
				</UserDetailContainer>
			);
		}

		return (
			<UserDetailContainer>
				<Empty className="min-h-(--content-full-height) border bg-background">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<AlertCircleIcon aria-hidden="true" />
						</EmptyMedia>
						<EmptyTitle>Could not load this user</EmptyTitle>
						<EmptyDescription>
							The user record could not be read. Try the request again.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button type="button" onClick={() => userQuery.refetch()}>
							Try again
						</Button>
						<Button asChild variant="outline">
							<Link to="/users">
								<ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
								Back to users
							</Link>
						</Button>
					</EmptyContent>
				</Empty>
			</UserDetailContainer>
		);
	}

	if (!userQuery.data) {
		return (
			<UserDetailContainer>
				<MissingUserState />
			</UserDetailContainer>
		);
	}

	const user = userQuery.data;
	const canManageAccess = session?.user.id !== user.id;

	return (
		<UserDetailContainer>
			<UserDetailHeader
				user={user}
				canManageAccess={canManageAccess}
				onGrantCredits={() => setOpenDialog("credits")}
				onToggleEarlyAccess={() => setOpenDialog("access")}
				onChangeRole={() => setOpenDialog("role")}
				onToggleBanned={() => setOpenDialog("ban")}
			/>
			<UserMetrics user={user} />

			{user.subscription ? (
				<UserSubscriptionCard subscription={user.subscription} />
			) : null}

			<UserWorkspacesCard workspaces={user.workspaces} />

			<UserActivityPanel
				userId={user.id}
				projects={user.projects}
				creditLedger={user.creditLedger}
			/>

			<GrantCreditsDialog
				user={user}
				open={openDialog === "credits"}
				onOpenChange={(open) => setOpenDialog(open ? "credits" : null)}
			/>
			{canManageAccess ? (
				<>
					<EarlyAccessDialog
						user={user}
						open={openDialog === "access"}
						onOpenChange={(open) => setOpenDialog(open ? "access" : null)}
					/>
					<ChangeRoleDialog
						user={user}
						open={openDialog === "role"}
						onOpenChange={(open) => setOpenDialog(open ? "role" : null)}
					/>
					<BanUserDialog
						user={user}
						open={openDialog === "ban"}
						onOpenChange={(open) => setOpenDialog(open ? "ban" : null)}
					/>
				</>
			) : null}
		</UserDetailContainer>
	);
}

function UserDetailContainer({ children }: PropsWithChildren) {
	return (
		<div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
			{children}
		</div>
	);
}

function MissingUserState() {
	return (
		<Empty className="min-h-(--content-full-height) border bg-background">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<UserRoundXIcon aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>User not found</EmptyTitle>
				<EmptyDescription>
					This account may have been removed, or the user ID is incorrect.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button asChild>
					<Link to="/users">
						<ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
						Back to users
					</Link>
				</Button>
			</EmptyContent>
		</Empty>
	);
}
