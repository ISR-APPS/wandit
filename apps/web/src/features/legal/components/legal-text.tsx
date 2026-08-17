import { useDictionary } from "@/lib/i18n";

import {
	GOOGLE_PERMISSIONS_URL,
	GOOGLE_USER_DATA_POLICY_URL,
	LEGAL_COMMERCIAL_REGISTER_NO,
	LEGAL_COMPANY,
	LEGAL_COMPANY_ADDRESS,
	LEGAL_CONTACT_EMAIL,
	LEGAL_DRIVE_SCOPE,
	LEGAL_SITE_URL,
	LEGAL_TRADE_LICENCE_NO,
} from "../lib/constants";
import { splitTemplate } from "../lib/template";

const linkClass =
	"rounded-sm underline underline-offset-2 outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * Renders one legal sentence: literal text stays text, and every {token}
 * becomes the node Google expects to find — a reachable mailbox, the policy
 * link, the permissions link, the exact Drive scope.
 */
export function LegalText({ value }: { value: string }) {
	const common = useDictionary().legal.common;

	return (
		<>
			{splitTemplate(value).map((part, index) => {
				// Parts are positional inside one immutable string, so the index is
				// the only stable identity they have.
				const key = `${part.kind}-${index}`;

				if (part.kind === "text") {
					return <span key={key}>{part.value}</span>;
				}

				switch (part.name) {
					case "company":
						return <span key={key}>{LEGAL_COMPANY}</span>;
					// Identity of the entity, printed as plain text like {company}:
					// these are register facts, not links a reader can follow.
					case "address":
						return <span key={key}>{LEGAL_COMPANY_ADDRESS}</span>;
					case "licenceNo":
						return <span key={key}>{LEGAL_TRADE_LICENCE_NO}</span>;
					case "registerNo":
						return <span key={key}>{LEGAL_COMMERCIAL_REGISTER_NO}</span>;
					case "email":
						return (
							<a
								key={key}
								href={`mailto:${LEGAL_CONTACT_EMAIL}`}
								className={linkClass}
							>
								{LEGAL_CONTACT_EMAIL}
							</a>
						);
					case "siteUrl":
						return (
							// Absolute, and in a new tab like the other external links:
							// the reader keeps the document they are on instead of
							// reloading the whole app on the home route.
							<a
								key={key}
								href={LEGAL_SITE_URL}
								className={linkClass}
								target="_blank"
								rel="noreferrer"
							>
								{LEGAL_SITE_URL.replace("https://", "")}
							</a>
						);
					case "driveScope":
						return (
							<code
								key={key}
								className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
							>
								{LEGAL_DRIVE_SCOPE}
							</code>
						);
					case "googlePolicyUrl":
						return (
							<a
								key={key}
								href={GOOGLE_USER_DATA_POLICY_URL}
								className={linkClass}
								target="_blank"
								rel="noreferrer"
							>
								{common.googlePolicyLabel}
							</a>
						);
					case "googlePermissionsUrl":
						return (
							<a
								key={key}
								href={GOOGLE_PERMISSIONS_URL}
								className={linkClass}
								target="_blank"
								rel="noreferrer"
							>
								{common.googlePermissionsLabel}
							</a>
						);
					default:
						// An unknown token means the copy moved ahead of this map; show
						// it raw rather than swallowing the sentence.
						return <span key={key}>{`{${part.name}}`}</span>;
				}
			})}
		</>
	);
}
