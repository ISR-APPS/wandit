/**
 * The scopes of one grant in plain words. The consent page and the connected-agents list render it.
 * A scope that this build does not know shows its raw name with a warning.
 */
import { CheckIcon } from "@phosphor-icons/react/Check";
import { WarningIcon } from "@phosphor-icons/react/Warning";

import { type TranslationKey, useTranslation } from "@/lib/i18n";
import type { ConsentScope, RequestedScope } from "../lib/helpers";

// One sentence per scope. The scope list of `@wandit/contracts` (`mcpScopes`) is the source.
const SCOPE_TEXT_KEYS = {
	"projects:read": "auth.codingAgents.scopes.projectsRead",
	"projects:write": "auth.codingAgents.scopes.projectsWrite",
	"builder:run": "auth.codingAgents.scopes.builderRun",
	"projects:deploy": "auth.codingAgents.scopes.projectsDeploy",
	offline_access: "auth.codingAgents.scopes.offlineAccess",
} as const satisfies Record<ConsentScope, TranslationKey>;

/** The scopes as a list of plain-word lines. */
export function ScopeList({
	scopes,
}: {
	/** The scopes from `parseRequestedScopes`: of the signed query on the consent page, of the consent row in the list. */
	scopes: RequestedScope[];
}) {
	const { t } = useTranslation();
	return (
		<ul className="flex flex-col gap-2 font-sans text-[14px] text-night/80 dark:text-foreground/80">
			{scopes.map((scope) =>
				scope.kind === "known" ? (
					<li key={scope.scope} className="flex items-start gap-2">
						<CheckIcon
							aria-hidden
							weight="bold"
							className="mt-0.5 size-4 shrink-0 text-success-text"
						/>
						<span>{t(SCOPE_TEXT_KEYS[scope.scope])}</span>
					</li>
				) : (
					<li
						key={scope.name}
						className="flex items-start gap-2 text-destructive"
					>
						<WarningIcon
							aria-hidden
							weight="bold"
							className="mt-0.5 size-4 shrink-0"
						/>
						<span className="min-w-0">
							{/* The raw scope is text from the client. It reads left to right in every locale. */}
							<code dir="ltr" className="break-all font-mono text-xs">
								{scope.name}
							</code>{" "}
							{t("auth.codingAgents.scopes.unknown")}
						</span>
					</li>
				),
			)}
		</ul>
	);
}
