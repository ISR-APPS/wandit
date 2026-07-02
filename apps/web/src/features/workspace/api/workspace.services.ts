// Raw async functions for the workspace entity — NO React in here. Currently
// mock implementations over lib/mock-workspace.ts with realistic latency;
// they become thin fetch wrappers over the shared api-client once the NestJS
// backend lands. The generation/publish "jobs" are simulated client-side in
// lib/store.tsx, which mutates the mock store through the sync helpers
// re-exported below and refreshes the query cache itself.

import { getWorkspaceSnapshot } from "../lib/mock-workspace";
import type { WorkspaceState } from "./dto";

const latency = () =>
	new Promise<void>((resolve) =>
		setTimeout(resolve, 350 + Math.random() * 200),
	);

export async function fetchWorkspaceState(
	projectId: string,
): Promise<WorkspaceState> {
	await latency();
	return getWorkspaceSnapshot(projectId);
}

// Sync mutators for the client-side job simulation (lib/store.tsx) and the
// settings tab. They swap for real endpoints together with the fetch above.
export {
	appendMockMessage,
	createMockVersion,
	deleteMockWorkspace,
	getWorkspaceSnapshot,
	patchMockDeployment,
	patchMockPixels,
} from "../lib/mock-workspace";
