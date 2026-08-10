// Placeholder sync control for COD Pilot, the Algerian COD platform we plan
// to integrate next. The button sits beside the Google Sheets sync so the
// Leads header already shows where the integration will live; it stays
// disabled until the integration lands. The span is what carries the tooltip:
// a disabled Button is pointer-events-none, so hovering it only reaches the
// wrapper.

import { Button } from "@wandit/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { Truck } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

export function CodPilotSyncButton() {
	const { t } = useTranslation();

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="inline-flex">
					<Button variant="outline" size="sm" disabled>
						<Truck />
						{t("leads.codPilotSync.sync")}
					</Button>
				</span>
			</TooltipTrigger>
			<TooltipContent>{t("leads.codPilotSync.comingSoon")}</TooltipContent>
		</Tooltip>
	);
}
