// Call + WhatsApp icon links for one lead — shared by the workspace Leads
// tab and the dashboard Leads page. `reveal` hides them until the table row
// is hovered (or a link is keyboard-focused).

import { Button } from "@wandit/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { MessageCircle, Phone } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { telHref, waHref } from "../../lib/helpers";

const HOVER_REVEAL =
	"opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-hover/row:opacity-100";

export function ContactLinks({
	phone,
	reveal = false,
}: {
	phone: string;
	reveal?: boolean;
}) {
	const { t } = useTranslation();
	const revealClass = reveal ? HOVER_REVEAL : undefined;
	return (
		<div className="flex items-center gap-0.5">
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						asChild
						variant="ghost"
						size="icon-xs"
						className={revealClass}
					>
						<a href={telHref(phone)} aria-label={t("leads.call")}>
							<Phone />
						</a>
					</Button>
				</TooltipTrigger>
				<TooltipContent>{t("leads.call")}</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						asChild
						variant="ghost"
						size="icon-xs"
						className={revealClass}
					>
						<a
							href={waHref(phone)}
							target="_blank"
							rel="noreferrer"
							aria-label={t("leads.whatsapp")}
						>
							<MessageCircle />
						</a>
					</Button>
				</TooltipTrigger>
				<TooltipContent>{t("leads.whatsapp")}</TooltipContent>
			</Tooltip>
		</div>
	);
}
