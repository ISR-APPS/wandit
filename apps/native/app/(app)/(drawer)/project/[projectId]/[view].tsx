import { WorkspaceViewsScreen } from "@/features/workspace/screens/workspace-views-screen";

// Catches the assets / marketing / leads segments (static routes win first);
// one route so dock switches are param updates, not stack transitions.
export default function WorkspaceViewRoute() {
	return <WorkspaceViewsScreen />;
}
