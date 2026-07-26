import { Link } from "@tanstack/react-router";
import { AlertCircleIcon, ArrowLeftIcon, UserRoundXIcon } from "lucide-react";
import { useState } from "react";

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
import { UserCreditLedger } from "@/features/users/components/detail/user-credit-ledger";
import { UserDetailHeader } from "@/features/users/components/detail/user-detail-header";
import { UserDetailSkeleton } from "@/features/users/components/detail/user-detail-skeleton";
import { UserMetrics } from "@/features/users/components/detail/user-metrics";
import { UserProjectsCard } from "@/features/users/components/detail/user-projects-card";
import { UserSubscriptionCard } from "@/features/users/components/detail/user-subscription-card";
import { GrantCreditsDialog } from "@/features/users/components/grant-credits-dialog";
import { isApiClientError } from "@/lib/api-client";

type UserDetailPageProps = {
	userId: string;
};

type OpenDialog = "credits" | "role" | "ban" | null;

export function UserDetailPage({ userId }: UserDetailPageProps) {
	const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
	const userQuery = useUserQuery(userId);
	const { data: session } = useSession();

	if (userQuery.isLoading) {
		return <UserDetailSkeleton />;
	}

	if (userQuery.isError) {
		// The AdminGuard answers 404 for missing users (and for non-admin
		// sessions, which the route guard already filters out).
		const isMissing =
			isApiClientError(userQuery.error) && userQuery.error.status === 404;

		if (isMissing) {
			return <MissingUserState />;
		}

		return (
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
		);
	}

	if (!userQuery.data) {
		return <MissingUserState />;
	}

	const user = userQuery.data;
	const canManageAccess = session?.user.id !== user.id;

	return (
		<div className="flex flex-col gap-6">
			<UserDetailHeader
				user={user}
				canManageAccess={canManageAccess}
				onGrantCredits={() => setOpenDialog("credits")}
				onChangeRole={() => setOpenDialog("role")}
				onToggleBanned={() => setOpenDialog("ban")}
			/>
			<UserMetrics user={user} />

			<div className="grid gap-4 xl:grid-cols-2">
				{user.subscription ? (
					<UserSubscriptionCard subscription={user.subscription} />
				) : null}
				<UserProjectsCard projects={user.projects} />
			</div>

			<UserCreditLedger entries={user.creditLedger} />

			<GrantCreditsDialog
				user={user}
				open={openDialog === "credits"}
				onOpenChange={(open) => setOpenDialog(open ? "credits" : null)}
			/>
			{canManageAccess ? (
				<>
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
