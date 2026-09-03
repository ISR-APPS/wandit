import { Link } from "@tanstack/react-router";

import { splitTemplate } from "../lib/template";

const consentLinkClass =
	"rounded-sm underline underline-offset-2 outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * Consent line for a sign-in surface: the {terms} and {privacy} tokens of the
 * caller's sentence become router links, because Google verification expects
 * both documents to be reachable from the consent step.
 *
 * The sentence and the labels are props rather than dictionary reads: the copy
 * belongs to the surface that shows it, and this component only knows how to
 * turn the two tokens into links.
 *
 * `onNavigate` runs before the router does. The only caller today lives inside
 * a dialog mounted at the app root, so without it the route would change under
 * an open modal that still covers the document the reader just asked for.
 */
export function LegalConsentSentence({
	template,
	termsLabel,
	privacyLabel,
	onNavigate,
}: {
	template: string;
	termsLabel: string;
	privacyLabel: string;
	onNavigate: () => void;
}) {
	return (
		<>
			{splitTemplate(template).map((part, index) => {
				// Parts are positional inside one immutable string, so the index is
				// the only stable identity they have.
				const key = `${part.kind}-${index}`;

				if (part.kind === "text") {
					return <span key={key}>{part.value}</span>;
				}

				if (part.name === "terms") {
					return (
						<Link
							key={key}
							to="/terms"
							className={consentLinkClass}
							onClick={onNavigate}
						>
							{termsLabel}
						</Link>
					);
				}

				if (part.name === "privacy") {
					return (
						<Link
							key={key}
							to="/privacy"
							className={consentLinkClass}
							onClick={onNavigate}
						>
							{privacyLabel}
						</Link>
					);
				}

				// An unknown token means the copy moved ahead of this map; show it
				// raw rather than swallowing the sentence.
				return <span key={key}>{`{${part.name}}`}</span>;
			})}
		</>
	);
}
