/**
 * The card of one starter template, in the look of the dashboard project card.
 * It shows the cover, the name, the kind badge, and the tagline in the UI language.
 * The `/templates` grid renders it. A click opens
 * `/templates/$templateId`. The detail page also shows StarterTemplateKindBadge.
 */
import type { Icon } from "@phosphor-icons/react";
import { AppWindowIcon } from "@phosphor-icons/react/AppWindow";
import { BrowserIcon } from "@phosphor-icons/react/Browser";
import { Link } from "@tanstack/react-router";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";
import type { StarterTemplate, StarterTemplateKind } from "../api/dto";
import { starterTemplateCoverUrl } from "../lib/helpers";
import { StarterTemplateImage } from "./starter-template-image";

// A browser for a website: its public pages are the value. A window for an app: the pages behind sign-in are.
const KIND_ICONS = {
	website: BrowserIcon,
	app: AppWindowIcon,
} as const satisfies Record<StarterTemplateKind, Icon>;

/** The pill that says "Website" or "App", with its icon. */
export function StarterTemplateKindBadge({
	kind,
}: {
	kind: StarterTemplateKind;
}) {
	const { t } = useTranslation();
	const KindIcon = KIND_ICONS[kind];
	return (
		<span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-night/[0.06] ps-2 pe-2.5 font-grotesk font-semibold text-[11px] text-night/70 dark:bg-white/[0.08] dark:text-foreground/70">
			<KindIcon aria-hidden weight="duotone" className="size-3.5" />
			{t(`templates.kinds.${kind}`)}
		</span>
	);
}

type StarterTemplateCardProps = {
	/** One entry of the catalog in packages/contracts. */
	starterTemplate: StarterTemplate;
};

/** One starter template in a grid. The cover loads only near the viewport. */
export function StarterTemplateCard({
	starterTemplate,
}: StarterTemplateCardProps) {
	const { locale } = useTranslation();

	return (
		// The outer div keeps still, so the cursor stays on it while the inner card lifts.
		<div className="group relative">
			<div className="h-full transition-transform duration-200 motion-safe:group-hover:-translate-y-1 motion-safe:group-focus-within:-translate-y-1">
				<Link
					to="/templates/$templateId"
					params={{ templateId: starterTemplate.id }}
					className={cn(
						"block h-full rounded-[1.75rem] bg-white p-1.5 ring-1 ring-night/[0.08]",
						// A solid bottom edge, like a key. It grows when the card lifts.
						"shadow-[0_2px_0_rgb(11_16_51/0.06)] transition-shadow duration-200 group-focus-within:shadow-[0_6px_0_rgb(11_16_51/0.12)] group-hover:shadow-[0_6px_0_rgb(11_16_51/0.12)]",
						"outline-offset-2 focus-visible:outline-2 focus-visible:outline-ember",
						"dark:bg-card dark:shadow-[0_2px_0_rgb(0_0_0/0.35)] dark:ring-white/10 dark:group-hover:shadow-[0_6px_0_rgb(0_0_0/0.5)] dark:group-focus-within:shadow-[0_6px_0_rgb(0_0_0/0.5)]",
					)}
				>
					{/* The name follows the image, so the image needs no text of its own. */}
					<StarterTemplateImage
						src={starterTemplateCoverUrl(starterTemplate.id)}
						alt=""
						mode={starterTemplate.mode}
						loading="lazy"
					/>
					<div className="px-3 pt-3 pb-2.5">
						<div className="flex items-center gap-2">
							<h3 className="min-w-0 flex-1 truncate font-grotesk font-semibold text-[15px] text-night tracking-[-0.01em] dark:text-foreground">
								{starterTemplate.name}
							</h3>
							<StarterTemplateKindBadge kind={starterTemplate.kind} />
						</div>
						{/* Two lines: a 60-character tagline does not fit in one line of a narrow card. */}
						<p className="mt-1 line-clamp-2 text-[13px] text-night/55 leading-snug dark:text-foreground/55">
							{starterTemplate.tagline[locale]}
						</p>
					</div>
				</Link>
			</div>
		</div>
	);
}
