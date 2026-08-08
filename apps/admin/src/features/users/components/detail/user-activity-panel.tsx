import { GlobeIcon } from "lucide-react";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AdminCreditLedgerEntry } from "@/features/users/api/users.dto";
import { formatWholeNumber } from "@/features/users/lib/formatters";

import { UserCreditLedgerTable } from "./user-credit-ledger";
import { UserLandingPages } from "./user-landing-pages";
import { UserProjectsList } from "./user-projects-list";

type UserActivityPanelProps = {
	userId: string;
	projectsCount: number;
	creditLedger: AdminCreditLedgerEntry[];
};

export function UserActivityPanel({
	userId,
	projectsCount,
	creditLedger,
}: UserActivityPanelProps) {
	return (
		<Card className="gap-0 shadow-none">
			<Tabs defaultValue="projects" className="gap-0">
				<CardHeader className="gap-4">
					<div className="space-y-1.5">
						<CardTitle>Activity</CardTitle>
						<CardDescription>
							Switch between this user&apos;s projects, credit ledger, and
							landing pages.
						</CardDescription>
					</div>
					<div className="-mx-6 overflow-x-auto border-b px-6">
						<TabsList variant="line" className="h-11 min-w-max">
							<TabsTrigger value="projects">
								Projects
								<span className="text-muted-foreground tabular-nums">
									{formatWholeNumber(projectsCount)}
								</span>
							</TabsTrigger>
							<TabsTrigger value="credit-ledger">
								Credit ledger
								<span className="text-muted-foreground tabular-nums">
									{formatWholeNumber(creditLedger.length)}
								</span>
							</TabsTrigger>
							<TabsTrigger value="landing-pages">
								<GlobeIcon aria-hidden="true" />
								Landing pages
							</TabsTrigger>
						</TabsList>
					</div>
				</CardHeader>
				<TabsContent value="projects" className="mt-0 outline-none">
					<CardContent className="pt-6">
						<UserProjectsList userId={userId} />
					</CardContent>
				</TabsContent>
				<TabsContent value="credit-ledger" className="mt-0 outline-none">
					<CardContent
						className={creditLedger.length > 0 ? "px-0 pt-6" : "pt-6"}
					>
						<UserCreditLedgerTable entries={creditLedger} />
					</CardContent>
				</TabsContent>
				<TabsContent value="landing-pages" className="mt-0 outline-none">
					<CardContent className="pt-6">
						<UserLandingPages userId={userId} />
					</CardContent>
				</TabsContent>
			</Tabs>
		</Card>
	);
}
