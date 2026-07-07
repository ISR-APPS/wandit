// Publish-flow steps of the panel (dc 4a steps 1–5): subdomain config,
// deploy progress, the live state with QR + share tools, the update review
// and the version history. Shared indicators live in publish-bits.tsx.

import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { Switch } from "@wandit/ui/components/switch";
import { cn } from "@wandit/ui/lib/utils";
import {
	ArrowUp,
	Check,
	ChevronRight,
	ExternalLink,
	Loader2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { relativeTime } from "@/lib/relative-time";
import {
	PUBLISH_DURATION_MS,
	PUBLISHED_DOMAIN,
	SLUG_CHECK_DEBOUNCE_MS,
} from "../../lib/constants";
import { hashString, isValidSlug, slugify } from "../../lib/helpers";
import { useWorkspace } from "../../lib/store";
import {
	CheckCircle,
	ChecklistRow,
	EmberOrb,
	FacebookIcon,
	InfoNote,
	InstagramIcon,
	LiveUrlRow,
	MockQr,
	PendingRing,
	PulseBar,
	roundIconClass,
	SpinnerArc,
	WhatsAppIcon,
} from "./publish-bits";

/** Scrollable step body with the panel's standard padding. */
export function PanelBody({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"scroll-warm min-h-0 flex-1 overflow-y-auto px-[18px] py-[18px]",
				className,
			)}
		>
			{children}
		</div>
	);
}

/** Pinned step footer — CTA + caption live here. */
export function PanelFooter({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex shrink-0 flex-col gap-[9px] border-t px-[18px] pt-4 pb-4">
			{children}
		</div>
	);
}

/** 200ms ticker while `active` — drives the fake progress checklists. */
export function useNow(active: boolean): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) return;
		const id = window.setInterval(() => setNow(Date.now()), 200);
		return () => window.clearInterval(id);
	}, [active]);
	return now;
}

// --- Step 1 · Publish config -------------------------------------------------

export function ConfigStep({ onPublishStart }: { onPublishStart: () => void }) {
	const { t } = useTranslation();
	const {
		projectId,
		project,
		state,
		versions,
		activeVersion,
		selectVersion,
		publish,
		updateSlug,
		setTab,
		setPublishPanelOpen,
	} = useWorkspace();
	const deployment = state?.deployment;
	const pixels = state?.pixels;

	const fallbackSlug = `page-${projectId.replace(/^p_/, "").slice(0, 12) || "wandit"}`;
	const initialSlug =
		deployment?.slug ?? slugify(project?.name ?? "", fallbackSlug);
	const [slug, setSlug] = useState(initialSlug);
	const [slugDirty, setSlugDirty] = useState(false);
	const [checking, setChecking] = useState(false);

	const slugValid = isValidSlug(slug);
	// Same mock availability rule as Settings — the auto slug is always free.
	const autoSlug = project ? slugify(project.name, "") : "";
	const slugTaken =
		slugValid &&
		hashString(slug) % 5 === 0 &&
		slug !== deployment?.slug &&
		slug !== autoSlug;

	useEffect(() => {
		if (!slugDirty || !isValidSlug(slug)) {
			setChecking(false);
			return;
		}
		setChecking(true);
		const id = window.setTimeout(
			() => setChecking(false),
			SLUG_CHECK_DEBOUNCE_MS,
		);
		return () => window.clearTimeout(id);
	}, [slug, slugDirty]);

	const canPublish =
		versions.length > 0 && slugValid && !slugTaken && !checking;

	const handlePublish = () => {
		if (!canPublish) return;
		if (slug !== deployment?.slug) updateSlug(slug);
		publish();
		onPublishStart();
	};

	const openSettings = () => {
		setPublishPanelOpen(false);
		setTab("settings");
	};

	const pixelRows = [
		{ name: "Meta Pixel", id: pixels?.metaPixelId ?? null },
		{ name: "TikTok Pixel", id: pixels?.tiktokPixelId ?? null },
	];

	return (
		<>
			<PanelBody className="flex flex-col gap-5 py-5">
				<div>
					<div className="mb-[9px] text-[13px] text-muted-foreground">
						{t("workspace.publish.panel.liveAtLabel")}
					</div>
					<div className="flex items-stretch overflow-hidden rounded-[11px] border bg-secondary transition-shadow focus-within:border-primary/40 focus-within:ring-[3px] focus-within:ring-primary/10">
						<input
							value={slug}
							onChange={(e) => {
								setSlug(e.target.value.toLowerCase());
								setSlugDirty(true);
							}}
							aria-label={t("workspace.publish.panel.liveAtLabel")}
							className="h-[42px] min-w-0 flex-1 border-e bg-background px-3 font-medium text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
						/>
						<span className="flex items-center px-3 text-[15px] text-muted-foreground">
							{PUBLISHED_DOMAIN}
						</span>
					</div>
					<div className="mt-[9px] flex items-center gap-[7px] text-[13px]">
						{!slugValid ? (
							<span className="text-destructive">
								{t("workspace.publish.panel.slugInvalid")}
							</span>
						) : checking ? (
							<>
								<Loader2 className="size-[13px] animate-spin text-muted-foreground" />
								<span className="text-muted-foreground">
									{t("workspace.publish.panel.slugChecking")}
								</span>
							</>
						) : slugTaken ? (
							<span className="text-destructive">
								{t("workspace.publish.panel.slugTaken")}
							</span>
						) : (
							<>
								<CheckCircle className="size-[15px]" />
								<span className="font-medium text-success-text">
									{t("workspace.publish.panel.available")}
								</span>
								<span className="text-muted-foreground">
									· {t("workspace.publish.panel.slugRules")}
								</span>
							</>
						)}
					</div>
				</div>

				<div className="rounded-2xl border bg-secondary p-[15px]">
					<div className="mb-3 font-medium text-[13px] text-foreground">
						{t("workspace.publish.panel.whatShipsTitle")}
					</div>
					<div className="flex flex-col gap-[11px] text-[13.5px]">
						<div className="flex items-center gap-2.5 text-ink-soft">
							<CheckCircle />
							{t("workspace.publish.panel.shipStyles")}
						</div>
						{pixelRows.map((pixel) =>
							pixel.id ? (
								<div
									key={pixel.name}
									className="flex items-center gap-2.5 text-ink-soft"
								>
									<CheckCircle />
									{t("workspace.publish.panel.shipPixelDetected", {
										name: pixel.name,
									})}
								</div>
							) : (
								<div
									key={pixel.name}
									className="flex items-center gap-2.5 text-muted-foreground"
								>
									<PendingRing />
									<span>
										{pixel.name} —{" "}
										<button
											type="button"
											onClick={openSettings}
											className="text-ember-text hover:underline"
										>
											{t("workspace.publish.panel.addInSettings")}
										</button>
									</span>
								</div>
							),
						)}
						<div className="flex items-center gap-2.5 text-ink-soft">
							<CheckCircle />
							{t("workspace.publish.panel.shipCod")}
						</div>
					</div>
				</div>

				{activeVersion ? (
					<div className="flex items-center gap-[11px] rounded-[14px] border px-[13px] py-[11px]">
						<span className="grid size-[38px] shrink-0 place-items-center rounded-[11px] bg-gradient-ember-deep">
							<span className="font-semibold text-white/90 text-xs">
								v{activeVersion.number}
							</span>
						</span>
						<div className="min-w-0 flex-1">
							<div className="font-medium text-[13.5px]">
								{t("workspace.publish.panel.publishingVersion", {
									n: activeVersion.number,
								})}
							</div>
							<div
								dir="auto"
								className="truncate text-[12.5px] text-muted-foreground"
							>
								{activeVersion.label}
							</div>
						</div>
						{versions.length > 1 ? (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="sm" className="h-[30px]">
										{t("workspace.publish.panel.changeVersion")}
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									{[...versions].reverse().map((version) => (
										<DropdownMenuItem
											key={version.id}
											onSelect={() => selectVersion(version.id)}
										>
											<span className="font-mono text-xs">
												v{version.number}
											</span>
											<span dir="auto" className="truncate">
												{version.label}
											</span>
											{version.id === activeVersion.id ? (
												<Check className="ms-auto size-3.5" />
											) : null}
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						) : null}
					</div>
				) : null}

				<InfoNote>{t("workspace.publish.panel.freeNote")}</InfoNote>
			</PanelBody>

			<PanelFooter>
				<Button
					onClick={handlePublish}
					disabled={!canPublish}
					className="h-12 w-full text-[15px]"
				>
					<ArrowUp className="size-4" strokeWidth={2.2} />
					{t("workspace.publish.panel.publishCta")}
				</Button>
				<div className="text-center text-muted-foreground text-xs">
					{t("workspace.publish.panel.publishHint")}
				</div>
			</PanelFooter>
		</>
	);
}

// --- Step 2 · Publishing progress ---------------------------------------------

const PUBLISH_STEP_FRACTIONS = [0.16, 0.36, 0.74];

export function PublishingStep({
	onCancelled,
}: {
	onCancelled: (stillLive: boolean) => void;
}) {
	const { t } = useTranslation();
	const { state, cancelPublish } = useWorkspace();
	const deployment = state?.deployment;
	const url = `${deployment?.slug ?? ""}${PUBLISHED_DOMAIN}`;

	const startRef = useRef(Date.now());
	const now = useNow(true);
	const elapsed = now - startRef.current;
	const progress = Math.min(96, (elapsed / PUBLISH_DURATION_MS) * 100);

	const stepState = (index: number): "done" | "active" | "pending" => {
		const done = PUBLISH_STEP_FRACTIONS.filter(
			(fraction) => elapsed >= fraction * PUBLISH_DURATION_MS,
		).length;
		if (index < done) return "done";
		if (index === done) return "active";
		return "pending";
	};

	const handleCancel = () => {
		const stillLive = deployment?.publishedVersionId != null;
		cancelPublish();
		onCancelled(stillLive);
	};

	return (
		<>
			<PanelBody className="flex flex-col py-[22px]">
				<div className="flex flex-col items-center pt-3.5 pb-[22px] text-center">
					<EmberOrb>
						<SpinnerArc onEmber className="size-[30px]" />
					</EmberOrb>
					<div className="mt-4 font-medium text-lg tracking-[-0.4px]">
						{t("workspace.publish.panel.deployTitle")}
					</div>
					<div className="mt-[5px] text-[13.5px] text-muted-foreground">
						{url}
					</div>
				</div>
				<div className="mb-[22px]">
					<PulseBar value={progress} />
				</div>
				<div className="flex flex-col gap-[15px]">
					<ChecklistRow state={stepState(0)}>
						{t("workspace.publish.panel.deployStepStyles")}
					</ChecklistRow>
					<ChecklistRow state={stepState(1)}>
						{t("workspace.publish.panel.deployStepPixels")}
					</ChecklistRow>
					<ChecklistRow state={stepState(2)}>
						{t("workspace.publish.panel.deployStepUpload")}
					</ChecklistRow>
					<ChecklistRow state={stepState(3)}>
						{t("workspace.publish.panel.deployStepDns")}
					</ChecklistRow>
				</div>
			</PanelBody>

			<PanelFooter>
				<Button
					variant="outline"
					onClick={handleCancel}
					className="h-12 w-full text-[14.5px] text-muted-foreground"
				>
					{t("workspace.publish.panel.cancel")}
				</Button>
				<div className="text-center text-muted-foreground text-xs">
					{t("workspace.publish.panel.backgroundNote")}
				</div>
			</PanelFooter>
		</>
	);
}

// --- Step 3 · You're live ------------------------------------------------------

export function LiveStep({ onShowHistory }: { onShowHistory: () => void }) {
	const { t } = useTranslation();
	const { state, liveUrl } = useWorkspace();
	const deployment = state?.deployment;
	const url = `${deployment?.slug ?? ""}${PUBLISHED_DOMAIN}`;
	const href = liveUrl ?? `https://${url}`;

	const share = (target: "whatsapp" | "facebook") => {
		const link =
			target === "whatsapp"
				? `https://wa.me/?text=${encodeURIComponent(href)}`
				: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(href)}`;
		window.open(link, "_blank", "noopener,noreferrer");
	};

	return (
		<>
			<PanelBody className="flex flex-col gap-4">
				<div className="flex flex-col items-center text-center">
					<EmberOrb className="size-14">
						<Check className="size-7 text-white" strokeWidth={2.6} />
					</EmberOrb>
					<div className="mt-[13px] font-medium text-[19px] tracking-[-0.5px]">
						{t("workspace.publish.panel.liveTitle")}
					</div>
					<div className="mt-1 text-[13.5px] text-muted-foreground">
						{t("workspace.publish.panel.liveSub")}
					</div>
				</div>

				<LiveUrlRow url={url} href={href} />

				<div className="flex items-center gap-3.5 rounded-2xl border p-3.5">
					<div className="size-24 shrink-0 rounded-[10px] border bg-background p-1.5">
						<MockQr className="size-full" />
					</div>
					<div className="min-w-0 flex-1">
						<div className="font-medium text-sm">
							{t("workspace.publish.panel.scanTitle")}
						</div>
						<div className="mt-[3px] text-[13px] text-muted-foreground leading-normal">
							{t("workspace.publish.panel.scanSub")}
						</div>
					</div>
				</div>

				<div>
					<div className="mb-[9px] text-[12.5px] text-muted-foreground">
						{t("workspace.publish.panel.shareTo")}
					</div>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => share("whatsapp")}
							className="flex h-[38px] flex-1 items-center justify-center gap-[7px] rounded-full border text-[13px] text-foreground transition-colors hover:bg-secondary"
						>
							<WhatsAppIcon className="size-4" />
							WhatsApp
						</button>
						<button
							type="button"
							aria-label="Facebook"
							onClick={() => share("facebook")}
							className={cn(roundIconClass, "h-[38px] w-[42px] bg-transparent")}
						>
							<FacebookIcon className="size-4" />
						</button>
						<button
							type="button"
							aria-label="Instagram"
							onClick={() => {
								void navigator.clipboard.writeText(href);
							}}
							className={cn(roundIconClass, "h-[38px] w-[42px] bg-transparent")}
						>
							<InstagramIcon className="size-4" />
						</button>
					</div>
				</div>

				<button
					type="button"
					onClick={onShowHistory}
					className="flex items-center justify-center gap-[7px] font-medium text-[13px] text-ember-text hover:underline"
				>
					{t("workspace.publish.panel.historyLink")}
					<ChevronRight className="size-3.5 rtl:rotate-180" strokeWidth={2} />
				</button>
			</PanelBody>

			<PanelFooter>
				<Button asChild className="h-12 w-full text-[15px]">
					<a href={href} target="_blank" rel="noreferrer">
						<ExternalLink className="size-[15px]" strokeWidth={1.9} />
						{t("workspace.publish.panel.openLive")}
					</a>
				</Button>
			</PanelFooter>
		</>
	);
}

// --- Step 4 · Publish update ----------------------------------------------------

const CHANGE_ROWS = [
	{
		sign: "+",
		className: "text-success-text",
		key: "workspace.publish.panel.change0",
	},
	{
		sign: "~",
		className: "text-ember-text",
		key: "workspace.publish.panel.change1",
	},
	{
		sign: "+",
		className: "text-success-text",
		key: "workspace.publish.panel.change2",
	},
	{
		sign: "−",
		className: "text-destructive",
		key: "workspace.publish.panel.change3",
	},
] as const;

export function UpdateStep({
	onPublishStart,
	onShowHistory,
}: {
	onPublishStart: () => void;
	onShowHistory: () => void;
}) {
	const { t } = useTranslation();
	const { state, publish, setPublishPanelOpen } = useWorkspace();
	const deployment = state?.deployment;
	const pixels = state?.pixels;
	const url = `${deployment?.slug ?? ""}${PUBLISHED_DOMAIN}`;
	const liveVersion = state?.versions.find(
		(v) => v.id === deployment?.publishedVersionId,
	);
	const [reinjectPixels, setReinjectPixels] = useState(true);

	const pixelName = pixels?.metaPixelId
		? "Meta Pixel"
		: pixels?.tiktokPixelId
			? "TikTok Pixel"
			: t("workspace.publish.panel.adPixels");

	// Canned mock change list (dc reference copy) — 4 shown + N folded.
	const changeItems = CHANGE_ROWS.map((row) => ({
		...row,
		label: t(row.key),
	}));

	return (
		<>
			<PanelBody className="flex flex-col gap-[15px]">
				<div className="flex items-center gap-[9px] rounded-[13px] border bg-secondary px-3 py-[11px]">
					<span
						aria-hidden
						className="size-2 shrink-0 rounded-full bg-success shadow-[0_0_0_3px_color-mix(in_oklab,var(--success)_18%,transparent)]"
					/>
					<div className="min-w-0 flex-1">
						<div className="font-medium text-[13.5px]">
							{t("workspace.publish.panel.liveNow", {
								n: liveVersion?.number ?? 1,
							})}
						</div>
						<div className="truncate text-[12.5px] text-muted-foreground">
							{url} ·{" "}
							{t("workspace.publish.panel.publishedWhen", {
								when: relativeTime(
									deployment?.publishedAt ?? new Date().toISOString(),
								),
							})}
						</div>
					</div>
				</div>

				<div>
					<div className="font-medium text-base tracking-[-0.4px]">
						{t("workspace.publish.panel.changesTitle", { count: 12 })}
					</div>
					<div className="mt-[3px] text-[13px] text-muted-foreground">
						{t("workspace.publish.panel.changesSub")}
					</div>
				</div>

				<div className="flex flex-col rounded-2xl border bg-secondary p-1.5">
					{changeItems.map((item, index) => (
						<div key={item.label}>
							{index > 0 ? (
								<div aria-hidden className="mx-1.5 h-px bg-border" />
							) : null}
							<div className="flex items-center gap-2.5 px-[11px] py-[9px] text-[13.5px] text-ink-soft">
								<span
									aria-hidden
									className={cn(
										"w-4 text-center font-semibold",
										item.className,
									)}
								>
									{item.sign}
								</span>
								{item.label}
							</div>
						</div>
					))}
					<div aria-hidden className="mx-1.5 h-px bg-border" />
					<button
						type="button"
						onClick={onShowHistory}
						className="px-[11px] py-[9px] text-start text-[13px] text-muted-foreground hover:text-foreground"
					>
						{t("workspace.publish.panel.moreChanges", { count: 8 })}
					</button>
				</div>

				<div className="flex items-center gap-[11px] rounded-[13px] border px-[13px] py-3">
					<div className="min-w-0 flex-1">
						<div className="font-medium text-[13.5px]">
							{t("workspace.publish.panel.pixelToggleTitle")}
						</div>
						<div className="text-muted-foreground text-xs">
							{t("workspace.publish.panel.pixelToggleSub", {
								name: pixelName,
							})}
						</div>
					</div>
					<Switch
						checked={reinjectPixels}
						onCheckedChange={setReinjectPixels}
						aria-label={t("workspace.publish.panel.pixelToggleTitle")}
					/>
				</div>

				<InfoNote className="mt-auto">
					{t("workspace.publish.panel.linkSameNote")}
				</InfoNote>
			</PanelBody>

			<PanelFooter>
				<div className="flex gap-[9px]">
					<Button
						variant="outline"
						onClick={() => setPublishPanelOpen(false)}
						className="h-12 px-[18px] text-[14.5px]"
					>
						{t("workspace.publish.panel.discard")}
					</Button>
					<Button
						onClick={() => {
							publish();
							onPublishStart();
						}}
						className="h-12 flex-1 text-[15px]"
					>
						<ArrowUp className="size-[15px]" strokeWidth={2.2} />
						{t("workspace.publish.panel.publishChanges")}
					</Button>
				</div>
			</PanelFooter>
		</>
	);
}

// --- Step 5 · Version history -----------------------------------------------------

/** Decorative badge backgrounds per row — live ember, then cooler mock hues. */
const VERSION_BADGE_BACKGROUNDS = [
	"bg-gradient-ember-deep",
	"bg-[linear-gradient(135deg,oklch(0.6_0.09_250),oklch(0.4_0.08_260))]",
	"bg-[linear-gradient(135deg,oklch(0.55_0.03_60),oklch(0.4_0.02_60))]",
];

export function HistoryStep({
	onRestoreStart,
	onUnpublished,
}: {
	onRestoreStart: () => void;
	onUnpublished: () => void;
}) {
	const { t } = useTranslation();
	const { state, versions, rollbackTo, unpublish } = useWorkspace();
	const deployment = state?.deployment;
	const ordered = [...versions].reverse();

	return (
		<PanelBody className="flex flex-col gap-3">
			<div className="text-[13px] text-muted-foreground">
				{t("workspace.publish.panel.historyIntro")}
			</div>

			{ordered.map((version, index) => {
				const isLive = version.id === deployment?.publishedVersionId;
				return (
					<div
						key={version.id}
						className={cn(
							"flex items-center gap-3 rounded-[14px] border p-[13px]",
							isLive && "border-success/35 bg-success/6",
						)}
					>
						<span
							className={cn(
								"grid size-10 shrink-0 place-items-center rounded-[11px]",
								isLive
									? VERSION_BADGE_BACKGROUNDS[0]
									: VERSION_BADGE_BACKGROUNDS[
											1 + (index % (VERSION_BADGE_BACKGROUNDS.length - 1))
										],
							)}
						>
							<span className="font-semibold text-white/90 text-xs">
								v{version.number}
							</span>
						</span>
						<div className="min-w-0 flex-1">
							<div dir="auto" className="truncate font-medium text-sm">
								v{version.number} · {version.label}
							</div>
							<div className="text-[12.5px] text-muted-foreground">
								{isLive
									? t("workspace.publish.panel.whenByYou", {
											when: relativeTime(
												deployment?.publishedAt ?? version.createdAt,
											),
										})
									: relativeTime(version.createdAt)}
							</div>
						</div>
						{isLive ? (
							<span className="flex shrink-0 items-center gap-[5px] rounded-full bg-success px-2.5 py-1 text-background text-xs">
								<span
									aria-hidden
									className="size-1.5 rounded-full bg-background"
								/>
								{t("workspace.publish.panel.liveChip")}
							</span>
						) : (
							<Button
								variant="outline"
								size="sm"
								disabled={deployment?.state === "publishing"}
								onClick={() => {
									rollbackTo(version.id);
									onRestoreStart();
								}}
							>
								{t("workspace.publish.panel.restore")}
							</Button>
						)}
					</div>
				);
			})}

			<div className="mt-auto rounded-[14px] border border-destructive/30 bg-destructive/4 px-3.5 py-[13px]">
				<div className="font-medium text-[13.5px] text-destructive">
					{t("workspace.publish.panel.offlineTitle")}
				</div>
				<div className="mt-1 mb-[11px] text-[12.5px] text-muted-foreground leading-normal">
					{t("workspace.publish.panel.offlineBody")}
				</div>
				<Button
					variant="outline"
					onClick={() => {
						unpublish();
						onUnpublished();
					}}
					className="h-10 w-full border-destructive/50 text-[13.5px] text-destructive hover:bg-destructive/5 hover:text-destructive"
				>
					{t("workspace.publish.panel.unpublishCta")}
				</Button>
			</div>
		</PanelBody>
	);
}
