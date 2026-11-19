// The icon of each feature area of the product, for the icon tiles of the home cards.
// The event volume card and the product areas card read it. The area name always shows beside the icon.
import {
	ChartBarIcon,
	ChatCircleIcon,
	CheckSquareIcon,
	FileIcon,
	KanbanIcon,
	LightningIcon,
	MagnifyingGlassIcon,
	PlugsConnectedIcon,
} from "@phosphor-icons/react";
import type { FeatureArea } from "~/features/tracking";
import type { KitIcon } from "~/shared/ui/icons";

/** One icon per feature area. The area name always shows beside it. */
export const AREA_ICONS = {
	tasks: CheckSquareIcon,
	projects: KanbanIcon,
	comments: ChatCircleIcon,
	search: MagnifyingGlassIcon,
	reports: ChartBarIcon,
	files: FileIcon,
	automations: LightningIcon,
	integrations: PlugsConnectedIcon,
} satisfies Record<FeatureArea, KitIcon>;
