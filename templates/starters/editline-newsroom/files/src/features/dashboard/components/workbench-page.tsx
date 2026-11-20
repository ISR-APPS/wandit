// Shows all stories in the workbench route.
// The list applies a local search to the sample records.
import { primaryRows } from "../lib/workspace";
import { WorkspaceList } from "./workspace-list";

/** Lists the main workspace records, with search and per-record context. */
export function WorkbenchPage() {
	return <WorkspaceList title="Stories" rows={primaryRows} />;
}
