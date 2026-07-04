import { useLocalSearchParams } from "expo-router";

import { WorkspaceShell } from "@/features/workspace/components/workspace-shell";

export default function ProjectLayout() {
	const { projectId } = useLocalSearchParams<{ projectId: string }>();

	return <WorkspaceShell projectId={projectId} />;
}
