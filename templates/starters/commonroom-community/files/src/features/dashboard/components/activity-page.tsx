// Shows members in the activity route.
// The list applies a local search to the sample records.
import { secondaryRows } from "../lib/workspace";
import { WorkspaceList } from "./workspace-list";

/** Lists the related workspace records, with search and per-record context. */
export function ActivityPage() {
	return <WorkspaceList title="Members" rows={secondaryRows} />;
}
