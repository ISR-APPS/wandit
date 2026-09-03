import { Link } from "@tanstack/react-router";
import type { AdminUserWorkspace } from "@wandit/contracts";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatAdminDate } from "@/features/users/lib/formatters";

/**
 * Team workspaces the user belongs to. Rendered only when memberships exist,
 * so pre-teams accounts keep their exact pre-teams detail page.
 */
export function UserWorkspacesCard({
	workspaces,
	className,
}: {
	workspaces: AdminUserWorkspace[];
	className?: string;
}) {
	if (workspaces.length === 0) {
		return null;
	}

	return (
		<Card className={`shadow-none ${className ?? ""}`}>
			<CardHeader>
				<CardTitle>Workspaces</CardTitle>
				<CardDescription>Team workspaces this user belongs to.</CardDescription>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Workspace</TableHead>
							<TableHead>Role</TableHead>
							<TableHead>Joined</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{workspaces.map((workspace) => (
							<TableRow key={workspace.organizationId}>
								<TableCell>
									<Link
										to="/organizations/$organizationId"
										params={{ organizationId: workspace.organizationId }}
										className="flex min-w-0 flex-col hover:underline"
									>
										<span className="truncate font-medium">
											{workspace.name}
										</span>
										<span className="truncate text-muted-foreground text-xs">
											{workspace.slug}
										</span>
									</Link>
								</TableCell>
								<TableCell>
									<Badge variant="outline" className="capitalize">
										{workspace.role}
									</Badge>
								</TableCell>
								<TableCell className="text-muted-foreground text-sm">
									{formatAdminDate(workspace.joinedAt)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
