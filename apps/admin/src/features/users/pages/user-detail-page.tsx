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
import { useUserQuery } from "@/features/users/api/users.queries";
import { BanUserDialog } from "@/features/users/components/ban-user-dialog";
import { ChangeRoleDialog } from "@/features/users/components/change-role-dialog";
import { UserDetailHeader } from "@/features/users/components/detail/user-detail-header";
import { UserDetailSkeleton } from "@/features/users/components/detail/user-detail-skeleton";
import { UserDetailTabs } from "@/features/users/components/detail/user-detail-tabs";
import { UserMetrics } from "@/features/users/components/detail/user-metrics";
import { GrantCreditsDialog } from "@/features/users/components/grant-credits-dialog";

type UserDetailPageProps = {
	userId: string;
};

type OpenDialog = "credits" | "role" | "ban" | null;

export function UserDetailPage({ userId }: UserDetailPageProps) {
	const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
	const userQuery = useUserQuery(userId);

	if (userQuery.isLoading) {
		return <UserDetailSkeleton />;
	}

	if (userQuery.isError) {
		const isMissing =
			userQuery.error instanceof Error &&
			userQuery.error.message.toLowerCase().includes("not found");

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
						The mock user record could not be read. Try the request again.
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

	return (
		<div className="flex flex-col gap-6">
			<UserDetailHeader
				user={user}
				onGrantCredits={() => setOpenDialog("credits")}
				onChangeRole={() => setOpenDialog("role")}
				onToggleBanned={() => setOpenDialog("ban")}
			/>
			<UserMetrics user={user} />
			<UserDetailTabs user={user} />

			<GrantCreditsDialog
				user={user}
				open={openDialog === "credits"}
				onOpenChange={(open) => setOpenDialog(open ? "credits" : null)}
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
