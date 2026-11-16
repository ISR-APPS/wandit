// The stage of a matter as a Badge: a dot in the color of its stage, then the word.
// The matter list, the matter detail page, and the client sheet render it.

import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { MATTER_STAGE_DOT, type MatterStage } from "../lib/matter-stage";

type MatterStageBadgeProps = {
	stage: MatterStage;
};

/** Every stage uses the quiet outline badge, so the solid primary color marks only the main action. */
export function MatterStageBadge({ stage }: MatterStageBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant="outline">
			<span
				aria-hidden="true"
				className={cn("size-1.5 rounded-full", MATTER_STAGE_DOT[stage])}
			/>
			{t(`stages.${stage}`)}
		</Badge>
	);
}
