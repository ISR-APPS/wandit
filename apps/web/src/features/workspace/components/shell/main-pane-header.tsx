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

import { useTranslation } from "@/lib/i18n";
import type { WorkspaceTab } from "../../api/dto";
import { useWorkspace } from "../../lib/store";
import { MarketingControls } from "../marketing/marketing-controls";
import { PageControls } from "../page/page-toolbar";
import { WorkspaceTabs } from "./workspace-tabs";

export function MainPaneHeader({
	tab,
	onReloadPage,
}: {
	tab: WorkspaceTab;
	onReloadPage: () => void;
}) {
	const { t } = useTranslation();
	const { chatOpen, toggleChat } = useWorkspace();

	return (
		<div className="flex h-12 shrink-0 items-center gap-2 border-b px-3.5">
			{!chatOpen ? (
				<>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={toggleChat}
								aria-label={t("workspace.chat.expand")}
							>
								<PanelLeftOpen className="size-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="bottom">
							{t("workspace.chat.expand")}
						</TooltipContent>
					</Tooltip>
					<Separator
						orientation="vertical"
						className="data-[orientation=vertical]:h-4"
					/>
				</>
			) : null}

			<WorkspaceTabs />

			<div className="ms-auto flex min-w-0 items-center gap-2">
				{tab === "page" ? <PageControls onReload={onReloadPage} /> : null}
				{tab === "marketing" ? <MarketingControls /> : null}
			</div>
		</div>
	);
}
