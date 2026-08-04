import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
	AdminCreditLedgerEntry,
	AdminUserProject,
} from "@/features/users/api/users.dto";
import { formatWholeNumber } from "@/features/users/lib/formatters";

import { UserCreditLedgerTable } from "./user-credit-ledger";
import { UserProjectsList } from "./user-projects-list";

type UserActivityPanelProps = {
	userId: string;
	projects: AdminUserProject[];
	creditLedger: AdminCreditLedgerEntry[];
};

export function UserActivityPanel({
	userId,
	projects,
	creditLedger,
}: UserActivityPanelProps) {
	return (
		<Card className="gap-0 shadow-none">
			<Tabs defaultValue="projects" className="gap-0">
				<CardHeader className="gap-4">
					<div className="space-y-1.5">
						<CardTitle>Activity</CardTitle>
						<CardDescription>
							Switch between this user&apos;s projects and credit ledger.
						</CardDescription>
					</div>
					<div className="-mx-6 overflow-x-auto border-b px-6">
						<TabsList variant="line" className="h-11 min-w-max">
							<TabsTrigger value="projects">
								Projects
								<span className="text-muted-foreground tabular-nums">
									{formatWholeNumber(projects.length)}
								</span>
							</TabsTrigger>
							<TabsTrigger value="credit-ledger">
								Credit ledger
								<span className="text-muted-foreground tabular-nums">
									{formatWholeNumber(creditLedger.length)}
								</span>
							</TabsTrigger>
						</TabsList>
					</div>
				</CardHeader>
				<TabsContent value="projects" className="mt-0 outline-none">
					<CardContent>
						<UserProjectsList userId={userId} projects={projects} />
					</CardContent>
				</TabsContent>
				<TabsContent value="credit-ledger" className="mt-0 outline-none">
					<CardContent className={creditLedger.length > 0 ? "px-0" : undefined}>
						<UserCreditLedgerTable entries={creditLedger} />
					</CardContent>
				</TabsContent>
			</Tabs>
		</Card>
	);
}
