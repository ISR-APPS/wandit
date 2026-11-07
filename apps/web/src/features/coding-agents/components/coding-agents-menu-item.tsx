/**
 * The "Coding agents" item of the account menu. It links to /coding-agents.
 * UserMenu in features/auth renders it inside its dropdown. It reads useV2BuilderEnabled.
 */
import { TerminalWindowIcon } from "@phosphor-icons/react/TerminalWindow";
import { Link } from "@tanstack/react-router";
import { DropdownMenuItem } from "@wandit/ui/components/dropdown-menu";

import { useV2BuilderEnabled } from "@/features/app-builder";
import { useTranslation } from "@/lib/i18n";

/** The menu link to /coding-agents. Renders nothing while V2 is closed for the user. */
export function CodingAgentsMenuItem() {
	const { t } = useTranslation();
	const isV2Enabled = useV2BuilderEnabled();
	// Product rule: coding agents work on V2 projects only.
	if (!isV2Enabled) {
		return null;
	}
	return (
		<DropdownMenuItem asChild>
			<Link to="/coding-agents">
				<TerminalWindowIcon aria-hidden weight="duotone" />
				{t("auth.codingAgents.menuItem")}
			</Link>
		</DropdownMenuItem>
	);
}
