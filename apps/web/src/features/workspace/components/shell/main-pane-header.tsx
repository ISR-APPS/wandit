// The main card's own header row: workspace tabs on the left, the active
// tab's contextual controls on the right (Page → version/viewport/preview
// actions, Assets → Library/Canvas toggle, Marketing → export/update plan).
// Leads and Settings keep their controls next to their content. Also hosts
// the chat re-open affordance when the chat card is collapsed.

import { Button } from "@wandit/ui/components/button";
import { Separator } from "@wandit/ui/components/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { PanelLeftOpen } from "lucide-react";

import type { WorkspaceTab } from "../../api/dto";
import { WORKSPACE_COPY } from "../../lib/constants";
import type { AssetsView } from "../../lib/helpers";
import { useWorkspace } from "../../lib/store";
import { AssetsViewToggle } from "../assets/assets-view-toggle";
import { MarketingControls } from "../marketing/marketing-controls";
import { PageControls } from "../page/page-toolbar";
import { WorkspaceTabs } from "./workspace-tabs";

export function MainPaneHeader({
	tab,
	onReloadPage,
	assetsView,
	onAssetsViewChange,
}: {
	tab: WorkspaceTab;
	onReloadPage: () => void;
	assetsView: AssetsView;
	onAssetsViewChange: (view: AssetsView) => void;
}) {
	const { chatOpen, toggleChat, versions, statePending } = useWorkspace();

	const showAssetsToggle = !statePending && versions.length > 0;

	return (
		<div className="flex h-12 shrink-0 items-center gap-2 border-b px-2.5">
			{!chatOpen ? (
				<>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={toggleChat}
								aria-label={WORKSPACE_COPY.chat.expand}
							>
								<PanelLeftOpen className="size-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom">
							{WORKSPACE_COPY.chat.expand}
						</TooltipContent>
					</Tooltip>
					<Separator
						orientation="vertical"
						className="data-[orientation=vertical]:h-4"
					/>
				</>
			) : null}

			<WorkspaceTabs />

			<div className="ml-auto flex min-w-0 items-center gap-1">
				{tab === "page" ? <PageControls onReload={onReloadPage} /> : null}
				{tab === "assets" && showAssetsToggle ? (
					<AssetsViewToggle view={assetsView} onChange={onAssetsViewChange} />
				) : null}
				{tab === "marketing" ? <MarketingControls /> : null}
			</div>
		</div>
	);
}
