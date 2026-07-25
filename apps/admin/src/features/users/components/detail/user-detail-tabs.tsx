import {
	FilesIcon,
	Globe2Icon,
	HistoryIcon,
	LayoutDashboardIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AdminUserDetail } from "@/features/users/api/users.dto";

import { UserAssetsTab } from "./user-assets-tab";
import { UserCreditsTab } from "./user-credits-tab";
import { UserOverviewTab } from "./user-overview-tab";
import { UserWebsitesTab } from "./user-websites-tab";

type UserDetailTabsProps = {
	user: AdminUserDetail;
};

export function UserDetailTabs({ user }: UserDetailTabsProps) {
	return (
		<Tabs defaultValue="overview" className="gap-5">
			<div className="overflow-x-auto">
				<TabsList variant="line" aria-label="User detail sections">
					<TabsTrigger value="overview">
						<LayoutDashboardIcon aria-hidden="true" />
						Overview
					</TabsTrigger>
					<TabsTrigger value="websites">
						<Globe2Icon aria-hidden="true" />
						Websites
						<Badge variant="secondary">{user.websites.length}</Badge>
					</TabsTrigger>
					<TabsTrigger value="assets">
						<FilesIcon aria-hidden="true" />
						Assets
						<Badge variant="secondary">{user.assets.length}</Badge>
					</TabsTrigger>
					<TabsTrigger value="credits">
						<HistoryIcon aria-hidden="true" />
						Credits
						<Badge variant="secondary">{user.creditLedger.length}</Badge>
					</TabsTrigger>
				</TabsList>
			</div>

			<TabsContent value="overview">
				<UserOverviewTab user={user} />
			</TabsContent>
			<TabsContent value="websites">
				<UserWebsitesTab websites={user.websites} />
			</TabsContent>
			<TabsContent value="assets">
				<UserAssetsTab assets={user.assets} />
			</TabsContent>
			<TabsContent value="credits">
				<UserCreditsTab entries={user.creditLedger} />
			</TabsContent>
		</Tabs>
	);
}
