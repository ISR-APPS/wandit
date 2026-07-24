import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import {
	Popover,
	PopoverArrow,
	PopoverContent,
	PopoverTrigger,
} from "@wandit/ui/components/popover";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import {
	ArrowUp,
	Check,
	ChevronRight,
	Copy,
	ExternalLink,
	Globe2,
	Loader2,
	Pencil,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { Spark } from "@/components/logo";
import { useTranslation } from "@/lib/i18n";
import { PUBLISHED_DOMAIN } from "../../lib/constants";
import { isValidSlug, slugify } from "../../lib/helpers";
import { useWorkspace } from "../../lib/store";
import { DomainPurchaseDialog } from "./domain-purchase-dialog";

type ConnectedDomain = {
	name: string;
	primary: boolean;
};

export function PublishPopover() {
	const { t } = useTranslation();
	const {
		activeVersion,
		project,
		projectId,
		publish,
		state,
		statePending,
		updateSlug,
	} = useWorkspace();
	const deployment = state?.deployment;

	const fallbackSlug = `page-${projectId.replace(/^p_/, "").slice(0, 12) || "wandit"}`;
	const slug = deployment?.slug ?? slugify(project?.name ?? "", fallbackSlug);
	const subdomain = `${slug}${PUBLISHED_DOMAIN}`;

	const [popoverOpen, setPopoverOpen] = useState(false);
	const [purchaseOpen, setPurchaseOpen] = useState(false);
	const [customDomain, setCustomDomain] = useState<ConnectedDomain | null>(
		null,
	);
	const [editingSlug, setEditingSlug] = useState(false);
	const [slugDraft, setSlugDraft] = useState(slug);

	useEffect(() => {
		if (!editingSlug) setSlugDraft(slug);
	}, [editingSlug, slug]);

	if (statePending || !deployment) {
		return <Skeleton className="h-8 w-24 rounded-full" />;
	}

	const publishing = deployment.state === "publishing";
	const published = deployment.state === "published";
	const canPublish = activeVersion != null && isValidSlug(slug);

	const saveSlug = () => {
		const normalized = slugify(slugDraft, slug);
		setSlugDraft(normalized);
		setEditingSlug(false);
		if (normalized !== slug) updateSlug(normalized);
	};

	const copyUrl = async (url: string) => {
		await navigator.clipboard.writeText(url);
		toast.success(t("workspace.publish.linkCopied"));
	};

	const openPurchase = () => {
		setPopoverOpen(false);
		setPurchaseOpen(true);
	};

	const handlePurchaseOpenChange = (nextOpen: boolean) => {
		setPurchaseOpen(nextOpen);
		if (!nextOpen) {
			queueMicrotask(() => setPopoverOpen(true));
		}
	};

	const handleConnected = (domain: string, primary: boolean) => {
		setCustomDomain({ name: domain, primary });
		if (!published && !publishing) publish();
	};

	const triggerLabel = publishing
		? t("workspace.publish.publishing")
		: customDomain || published
			? t("workspace.publish.published")
			: t("workspace.publish.publish");

	return (
		<>
			<Popover modal open={popoverOpen} onOpenChange={setPopoverOpen}>
				<PopoverTrigger asChild>
					<Button size="sm" className="h-8 px-4">
						{publishing ? (
							<Loader2 data-icon="inline-start" className="animate-spin" />
						) : customDomain || published ? (
							<Check data-icon="inline-start" />
						) : (
							<ArrowUp data-icon="inline-start" />
						)}
						{triggerLabel}
					</Button>
				</PopoverTrigger>

				{popoverOpen
					? createPortal(
							<div
								aria-hidden
								className="pointer-events-auto fixed inset-x-0 top-[52px] bottom-0 z-40 bg-foreground/15"
							/>,
							document.body,
						)
					: null}

				<PopoverContent
					align="end"
					alignOffset={-2}
					sideOffset={10}
					className="w-[min(404px,calc(100vw-1.5rem))] overflow-hidden rounded-[18px] p-0 shadow-[0_34px_70px_-26px_rgb(0_0_0/0.4),0_0_0_0.5px_rgb(0_0_0/0.03)]"
				>
					<PopoverArrow className="size-3" />
					{customDomain ? (
						<CustomDomainLiveContent
							domain={customDomain.name}
							primary={customDomain.primary}
							subdomain={subdomain}
							subdomainPublishing={publishing}
							onCopy={copyUrl}
						/>
					) : (
						<SubdomainContent
							slug={slug}
							slugDraft={slugDraft}
							subdomain={subdomain}
							live={published}
							publishing={publishing}
							canPublish={canPublish}
							editingSlug={editingSlug}
							onSlugDraftChange={setSlugDraft}
							onEditSlug={() => setEditingSlug(true)}
							onCancelSlug={() => {
								setSlugDraft(slug);
								setEditingSlug(false);
							}}
							onSaveSlug={saveSlug}
							onCopy={copyUrl}
							onOpenPurchase={openPurchase}
							onPublish={publish}
						/>
					)}
				</PopoverContent>
			</Popover>

			<DomainPurchaseDialog
				open={purchaseOpen}
				onOpenChange={handlePurchaseOpenChange}
				suggestedStem={slug.replaceAll("-", "")}
				subdomainUrl={subdomain}
				onConnected={handleConnected}
			/>
		</>
	);
}

function PublishStatusHeader({
	state,
}: {
	state: "draft" | "publishing" | "published";
}) {
	const { t } = useTranslation();
	const label =
		state === "publishing"
			? t("workspace.publish.publishing")
			: state === "published"
				? t("workspace.publish.published")
				: t("workspace.publish.popover.notPublished");

	return (
		<header className="flex items-center gap-[9px] px-4 pt-[15px] pb-3">
			<span
				aria-hidden
				className={cn(
					"size-[9px] shrink-0 rounded-full",
					state === "draft" && "bg-stone",
					state === "publishing" &&
						"animate-pulse-soft bg-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_16%,transparent)]",
					state === "published" &&
						"bg-success shadow-[0_0_0_3px_color-mix(in_oklab,var(--success)_18%,transparent)]",
				)}
			/>
			<div className="min-w-0 flex-1">
				<div className="truncate font-semibold text-[15.5px] tracking-[-0.4px]">
					{label}
				</div>
				{state === "published" ? (
					<div className="mt-0.5 text-muted-foreground text-xs">
						{t("workspace.publish.popover.publishedMeta")}
					</div>
				) : null}
			</div>
		</header>
	);
}

function SubdomainContent({
	slug,
	slugDraft,
	subdomain,
	live,
	publishing,
	canPublish,
	editingSlug,
	onSlugDraftChange,
	onEditSlug,
	onCancelSlug,
	onSaveSlug,
	onCopy,
	onOpenPurchase,
	onPublish,
}: {
	slug: string;
	slugDraft: string;
	subdomain: string;
	live: boolean;
	publishing: boolean;
	canPublish: boolean;
	editingSlug: boolean;
	onSlugDraftChange: (value: string) => void;
	onEditSlug: () => void;
	onCancelSlug: () => void;
	onSaveSlug: () => void;
	onCopy: (url: string) => Promise<void>;
	onOpenPurchase: () => void;
	onPublish: () => void;
}) {
	const { t } = useTranslation();
	const href = `https://${subdomain}`;
	const state = publishing ? "publishing" : live ? "published" : "draft";

	return (
		<>
			<PublishStatusHeader state={state} />

			<div className="flex flex-col gap-[9px] px-4 pb-3.5">
				<div className="mt-0.5 font-medium text-muted-foreground text-xs">
					{t("workspace.publish.popover.websiteUrl")}
				</div>

				<div className="flex min-h-13 items-center gap-[11px] rounded-[14px] border bg-secondary px-3 py-2.5">
					<span className="grid size-7 shrink-0 place-items-center rounded-lg bg-gradient-ember">
						<Spark className="size-3.5 text-background" />
					</span>

					{editingSlug ? (
						<div className="flex min-w-0 flex-1 items-center gap-1">
							<Input
								autoFocus
								value={slugDraft}
								onChange={(event) =>
									onSlugDraftChange(event.target.value.toLowerCase())
								}
								onKeyDown={(event) => {
									if (event.key === "Enter") onSaveSlug();
									if (event.key === "Escape") onCancelSlug();
								}}
								aria-label={t("workspace.publish.popover.editSubdomain")}
								className="h-8 min-w-0 rounded-lg bg-background font-semibold"
								dir="ltr"
							/>
							<span
								dir="ltr"
								className="shrink-0 text-muted-foreground text-xs"
							>
								{PUBLISHED_DOMAIN}
							</span>
							<Button
								size="icon-sm"
								variant="ghost"
								onClick={onSaveSlug}
								disabled={!isValidSlug(slugDraft)}
								aria-label={t("workspace.publish.popover.saveSubdomain")}
							>
								<Check />
							</Button>
						</div>
					) : (
						<>
							<span dir="ltr" className="min-w-0 flex-1 truncate text-[14.5px]">
								<span className="font-semibold">{slug}</span>
								<span className="text-muted-foreground">
									{PUBLISHED_DOMAIN}
								</span>
							</span>
							{live ? (
								<>
									<Button
										size="icon-sm"
										variant="ghost"
										onClick={() => void onCopy(href)}
										aria-label={t("workspace.publish.copyLink")}
									>
										<Copy />
									</Button>
									<Button size="icon-sm" variant="ghost" asChild>
										<a
											href={href}
											target="_blank"
											rel="noreferrer"
											aria-label={t("workspace.publish.openLive")}
										>
											<ExternalLink />
										</a>
									</Button>
								</>
							) : (
								<Button
									size="icon-sm"
									variant="ghost"
									onClick={onEditSlug}
									aria-label={t("workspace.publish.popover.editSubdomain")}
								>
									<Pencil />
								</Button>
							)}
						</>
					)}
				</div>

				<div className="flex items-center gap-[11px] rounded-[14px] border px-3 py-3">
					<Globe2 className="size-4 shrink-0 text-muted-foreground" />
					<span className="min-w-0 flex-1 text-[13.5px]">
						{t("workspace.publish.popover.visibility")}
					</span>
				</div>

				<button
					type="button"
					onClick={onOpenPurchase}
					className="group flex w-full items-center gap-3 rounded-[14px] border border-primary/30 bg-primary/5 px-3 py-3 text-start outline-none transition-[transform,background-color,border-color] hover:border-primary/45 hover:bg-primary/10 focus-visible:ring-[3px] focus-visible:ring-ring/30 active:scale-[0.99]"
				>
					<span className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-primary/10 text-ember-text">
						<Globe2 className="size-[17px]" strokeWidth={1.8} />
					</span>
					<span className="min-w-0 flex-1">
						<span className="block font-medium text-sm">
							{t("workspace.publish.popover.customDomainTitle")}
						</span>
						<span className="mt-0.5 block text-muted-foreground text-xs leading-relaxed">
							{t("workspace.publish.popover.customDomainDescription")}
						</span>
					</span>
					<ChevronRight className="size-4 shrink-0 text-ember-text transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
				</button>
			</div>

			<footer className="flex items-center gap-3 border-t bg-secondary px-4 py-[13px]">
				<span className="min-w-0 flex-1 text-muted-foreground text-xs">
					{live
						? t("workspace.publish.popover.publishedHint")
						: t("workspace.publish.popover.freeTiming")}
				</span>
				{live ? (
					<Button size="lg" asChild>
						<a href={href} target="_blank" rel="noreferrer">
							<ExternalLink data-icon="inline-start" />
							{t("workspace.publish.popover.openLivePage")}
						</a>
					</Button>
				) : (
					<Button
						size="lg"
						onClick={onPublish}
						disabled={!canPublish || publishing}
					>
						{publishing ? (
							<Loader2 data-icon="inline-start" className="animate-spin" />
						) : (
							<ArrowUp data-icon="inline-start" />
						)}
						{publishing
							? t("workspace.publish.publishing")
							: t("workspace.publish.publish")}
					</Button>
				)}
			</footer>
		</>
	);
}

function CustomDomainLiveContent({
	domain,
	primary,
	subdomain,
	subdomainPublishing,
	onCopy,
}: {
	domain: string;
	primary: boolean;
	subdomain: string;
	subdomainPublishing: boolean;
	onCopy: (url: string) => Promise<void>;
}) {
	const { t } = useTranslation();
	const domainUrl = `https://${domain}`;

	return (
		<>
			<PublishStatusHeader state="published" />

			<div className="flex flex-col gap-[9px] px-4 pb-3.5">
				<div className="mt-0.5 font-medium text-muted-foreground text-xs">
					{t("workspace.publish.popover.liveOn")}
				</div>

				<div className="flex items-center gap-[9px] rounded-[14px] border bg-secondary px-3 py-2.5">
					<span
						aria-hidden
						className="size-2 shrink-0 rounded-full bg-success shadow-[0_0_0_3px_color-mix(in_oklab,var(--success)_18%,transparent)]"
					/>
					<span
						dir="ltr"
						className="min-w-0 flex-1 truncate font-semibold text-sm"
					>
						{domain}
					</span>
					{primary ? (
						<Badge variant="outline">
							{t("workspace.publish.popover.primary")}
						</Badge>
					) : null}
					<Button
						size="icon-sm"
						variant="ghost"
						onClick={() => void onCopy(domainUrl)}
						aria-label={t("workspace.publish.copyLink")}
					>
						<Copy />
					</Button>
					<Button size="icon-sm" variant="ghost" asChild>
						<a
							href={domainUrl}
							target="_blank"
							rel="noreferrer"
							aria-label={t("workspace.publish.popover.openDomain")}
						>
							<ExternalLink />
						</a>
					</Button>
				</div>

				<div className="flex items-center gap-[11px] rounded-[14px] border px-3 py-3">
					<span className="grid size-7 shrink-0 place-items-center rounded-lg bg-gradient-ember">
						<Spark className="size-3.5 text-background" />
					</span>
					<span dir="ltr" className="min-w-0 flex-1 truncate text-[13.5px]">
						{subdomain}
					</span>
					<span className="shrink-0 text-muted-foreground text-xs">
						{subdomainPublishing
							? t("workspace.publish.popover.stillPublishing")
							: t(
									primary
										? "workspace.publish.popover.alsoLive"
										: "workspace.publish.popover.primary",
								)}
					</span>
				</div>

				<div className="flex items-center gap-[11px] rounded-[14px] border px-3 py-3">
					<Globe2 className="size-4 shrink-0 text-muted-foreground" />
					<span className="min-w-0 flex-1 text-[13.5px]">
						{t("workspace.publish.popover.visibility")}
					</span>
				</div>
			</div>

			<footer className="flex items-center gap-3 border-t bg-secondary px-4 py-[13px]">
				<span className="min-w-0 flex-1 text-muted-foreground text-xs">
					{t("workspace.publish.popover.customConnectedHint")}
				</span>
				<Button size="lg" asChild>
					<a href={domainUrl} target="_blank" rel="noreferrer">
						<ExternalLink data-icon="inline-start" />
						{t("workspace.publish.popover.openDomain")}
					</a>
				</Button>
			</footer>
		</>
	);
}
