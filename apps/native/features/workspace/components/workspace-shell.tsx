import { TabList, TabSlot, Tabs, TabTrigger } from "expo-router/ui";
import { View } from "react-native";

import { ChatComposer } from "./chat/chat-composer";
import { WorkspaceHeader } from "./workspace-header";
import { WorkspaceTabButton } from "./workspace-tab-button";

type WorkspaceShellProps = {
	projectId: string;
};

// The workspace frame: header + top tab bar, the active tab screen in the
// middle, and the persistent chat composer docked at the bottom.
export function WorkspaceShell({ projectId }: WorkspaceShellProps) {
	return (
		<Tabs style={{ flex: 1 }}>
			<View className="flex-1 bg-background">
				<WorkspaceHeader projectId={projectId} />
				<TabList asChild>
					<View className="flex-row gap-2 px-4 py-2">
						<TabTrigger name="chat" href={`/project/${projectId}`} asChild>
							<WorkspaceTabButton label="Chat" />
						</TabTrigger>
						<TabTrigger
							name="preview"
							href={`/project/${projectId}/preview`}
							asChild
						>
							<WorkspaceTabButton label="Preview" />
						</TabTrigger>
						<TabTrigger
							name="leads"
							href={`/project/${projectId}/leads`}
							asChild
						>
							<WorkspaceTabButton label="Leads" />
						</TabTrigger>
						<TabTrigger
							name="settings"
							href={`/project/${projectId}/settings`}
							asChild
						>
							<WorkspaceTabButton label="Settings" />
						</TabTrigger>
					</View>
				</TabList>
				<TabSlot />
				{/* TODO: hide the composer on the leads/settings tabs if it gets in the way. */}
				<ChatComposer />
			</View>
		</Tabs>
	);
}
