import { WorkspacePlaceholder } from "../components/workspace-placeholder";

export function PreviewScreen() {
	return (
		<WorkspacePlaceholder
			title="Preview"
			description="Live preview of the generated landing page (sandboxed WebView) with version switching."
		/>
	);
}
