/**
 * Template detail page at `/templates/$templateId`. It shows the cover, the
 * screenshots, the name, the kind, the category, and the description. It
 * has one action: the "Use this template" button.
 * The route file imports it by path and passes the catalog entry of the URL id.
 * The button creates a V2 project through lib/hooks.ts and opens the builder.
 */
import { ArrowLeftIcon } from "@phosphor-icons/react/ArrowLeft";
import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { UserCirclePlusIcon } from "@phosphor-icons/react/UserCirclePlus";
import { Link } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";

import { InsufficientCreditsDialog } from "@/features/credits";
import { KeycapButton } from "@/features/landing";
import { DashboardShell } from "@/features/projects";
import { useTranslation } from "@/lib/i18n";
import type { StarterTemplate } from "../api/dto";
import { StarterTemplateKindBadge } from "../components/starter-template-card";
import { StarterTemplateImage } from "../components/starter-template-image";
import {
	starterTemplateCoverUrl,
	starterTemplateShotUrls,
} from "../lib/helpers";
import { useStarterTemplateStart } from "../lib/hooks";

// The white frame of an image, like the dashboard project card.
const IMAGE_FRAME_CLASS =
	"rounded-[1.75rem] bg-white p-1.5 shadow-[0_2px_0_rgb(11_16_51/0.06)] ring-1 ring-night/[0.08] dark:bg-card dark:shadow-[0_2px_0_rgb(0_0_0/0.35)] dark:ring-white/10";

type TemplateDetailPageProps = {
	/** The catalog entry of the URL id. The route loader answers not-found for an id with no entry. */
	starterTemplate: StarterTemplate;
};

/** One starter template. The images are at the start side; the text and the button stay in view beside them from `lg`. */
export default function TemplateDetailPage({
	starterTemplate,
}: TemplateDetailPageProps) {
	const { t, locale } = useTranslation();
	const { start, isStarting, insufficientOpen, setInsufficientOpen } =
		useStarterTemplateStart();

	return (
		<DashboardShell titleKey="templates.title">
			<div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 md:px-6">
				{/* -ms-3 aligns the label with the text column. */}
				<Button
					asChild
					variant="ghost"
					size="sm"
					className="-ms-3 rounded-full font-grotesk text-night/70 hover:bg-night/[0.06] hover:text-night dark:text-foreground/70 dark:hover:bg-white/[0.06]"
				>
					<Link to="/templates">
						<ArrowLeftIcon
							aria-hidden
							weight="bold"
							className="size-4 rtl:-scale-x-100"
						/>
						{t("templates.detail.back")}
					</Link>
				</Button>

				<article className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10">
					{/* The text is first in the page, so a phone shows the name and the button before the images. */}
					{/* top-24: the sticky top bar is 72 px high, and 24 px stay free under it. */}
					<div className="lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1">
						<div className="flex flex-wrap items-center gap-2">
							<StarterTemplateKindBadge kind={starterTemplate.kind} />
							<span className="inline-flex h-6 items-center rounded-full px-2.5 font-grotesk font-semibold text-[11px] text-night/70 ring-1 ring-night/15 dark:text-foreground/70 dark:ring-white/15">
								{t(`templates.categories.${starterTemplate.category}`)}
							</span>
						</div>
						<h1 className="mt-4 font-extrabold font-grotesk text-[clamp(1.75rem,3.6vw,2.5rem)] text-night leading-[1.05] tracking-[-0.04em] rtl:leading-[1.3] rtl:tracking-normal dark:text-foreground">
							{starterTemplate.name}
						</h1>
						<p className="mt-3 text-base text-night/60 leading-relaxed dark:text-foreground/60">
							{starterTemplate.description[locale]}
						</p>
						{/* The one ember action of the page: an ember key on its deep edge. */}
						<KeycapButton
							type="button"
							size="lg"
							disabled={isStarting}
							aria-busy={isStarting}
							onClick={() => void start(starterTemplate.id)}
							// Night focus shows on the light page, white focus on the dark page.
							className="mt-6 w-full bg-ember text-white [--keycap-edge:var(--color-ember-deep)] focus-visible:outline-night dark:focus-visible:outline-white"
						>
							{isStarting ? (
								<CircleNotchIcon
									aria-hidden
									weight="bold"
									className="size-5 animate-spin motion-reduce:animate-none"
								/>
							) : null}
							{t("templates.detail.use")}
						</KeycapButton>
						{/* Product rule: the value of an app is behind sign-in, so the user must make an account in the preview. */}
						{starterTemplate.kind === "app" ? (
							<p className="mt-5 flex items-start gap-2.5 rounded-2xl bg-night/[0.04] px-3.5 py-3 text-[13px] text-night/70 leading-snug dark:bg-white/[0.05] dark:text-foreground/70">
								<UserCirclePlusIcon
									aria-hidden
									weight="duotone"
									className="mt-px size-4 shrink-0"
								/>
								{t("templates.detail.appNote")}
							</p>
						) : null}
					</div>

					<div className="flex flex-col gap-5 lg:col-start-1 lg:row-start-1">
						<div className={IMAGE_FRAME_CLASS}>
							<StarterTemplateImage
								src={starterTemplateCoverUrl(starterTemplate.id)}
								alt={t("templates.detail.coverAlt", {
									name: starterTemplate.name,
								})}
								mode={starterTemplate.mode}
								// The cover is the largest image of the first view, so it loads at once.
								loading="eager"
							/>
						</div>
						{starterTemplateShotUrls(starterTemplate).map((shotUrl, index) => (
							<div key={shotUrl} className={IMAGE_FRAME_CLASS}>
								<StarterTemplateImage
									src={shotUrl}
									alt={t("templates.detail.shotAlt", {
										name: starterTemplate.name,
										number: index + 1,
									})}
									mode={starterTemplate.mode}
									loading="lazy"
								/>
							</div>
						))}
					</div>
				</article>

				<InsufficientCreditsDialog
					open={insufficientOpen}
					onOpenChange={setInsufficientOpen}
				/>
			</div>
		</DashboardShell>
	);
}
