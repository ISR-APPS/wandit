/**
 * The Thème sheet of a web project. It edits src/styles/theme.json with no agent turn.
 * web-preview.tsx lazy-loads it, because it holds the large contracts look catalog.
 * A control change resolves the theme in the browser with buildAppThemeFile. "Design with AI" asks the design route.
 * Both give the draft to WebPreview, and PreviewPanel posts it to the preview iframe.
 * Save calls the theme PUT, and Generate calls the theme design POST, through theme.mutations.ts.
 */

import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/ArrowCounterClockwise";
import { ShuffleIcon } from "@phosphor-icons/react/Shuffle";
import { SparkleIcon } from "@phosphor-icons/react/Sparkle";
import {
	APP_BODY_FONT_IDS,
	APP_DISPLAY_FONT_IDS,
	APP_LOOK_IDS,
	APP_THEME_OPTIONS,
	type AppLookId,
	type AppThemeCategory,
	type AppThemeFile,
	type AppThemePalette,
	type AppThemeSelection,
	appThemeNameSchema,
	buildAppThemeFile,
	coherentSelection,
	designAppThemeBodySchema,
	type GetAppThemeResponse,
	randomSelection,
} from "@wandit/contracts/v2/app-theme";
import {
	APP_FONTS,
	APP_HUES,
	APP_LOOK_FAMILIES,
	APP_LOOKS,
	APP_THEME_CATEGORIES,
} from "@wandit/contracts/v2/app-theme-catalog";
import { parseColor, toHex } from "@wandit/contracts/v2/app-theme-color";
import { Sentry } from "@wandit/observability/browser";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@wandit/ui/components/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@wandit/ui/components/sheet";
import { Textarea } from "@wandit/ui/components/textarea";
import { cn } from "@wandit/ui/lib/utils";
import {
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useId,
	useState,
} from "react";
import { toast } from "sonner";

import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { formatNumber, useTranslation } from "@/lib/i18n";
import { useDesignAppTheme, useSaveAppTheme } from "../../api/theme.mutations";
import { brandHexOf, isSameThemeSource } from "../../lib/helpers";
import {
	PANEL_INPUT_CLASS,
	PANEL_PRIMARY_BUTTON_CLASS,
	PANEL_SECONDARY_BUTTON_CLASS,
} from "../more/panel-shell";
import { SegmentedControl } from "../shell/segmented-control";
import { IconAction } from "../shell/top-bar";

/** Props of the lazy sheet. web-preview.tsx owns the open state and the draft. */
export type ThemeSheetProps = {
	/** The open project. Save writes its theme. */
	projectId: string;
	open: boolean;
	/** Closes the sheet on the X or on Escape. WebPreview then drops the draft. */
	onClose: () => void;
	/** The theme GET answer: the saved theme.json, the card of its world, and its head commit. */
	saved: GetAppThemeResponse;
	/** The draft that the preview shows, or null. With null, the controls show the saved theme. */
	draft: AppThemeFile | null;
	/** Sets or clears the draft. WebPreview passes the draft to PreviewPanel, which posts it to the preview iframe. */
	onDraftChange: (draft: AppThemeFile | null) => void;
	/** True while a turn runs. The controls and the buttons are disabled then. */
	isReadOnly: boolean;
};

/** The look ids of each family, in catalog order. The Look select shows one group per family. */
const LOOKS_BY_FAMILY = APP_LOOK_FAMILIES.map((family) => ({
	family,
	lookIds: APP_LOOK_IDS.filter((id) => APP_LOOKS[id].family === family),
}));

/**
 * The choices of the industry filter of the Look row. "other" is the fallback of the deal, not an industry.
 * The catalog spec gives each category 4 looks or more, so no choice shows an empty list.
 */
const INDUSTRY_FILTERS = APP_THEME_CATEGORIES.filter(
	(category): category is Exclude<AppThemeCategory, "other"> =>
		category !== "other",
);

/** The example briefs of "Design with AI". A chip puts its localized text in the field. */
const DESIGN_EXAMPLES = ["clinic", "hotel", "school", "law"] as const;

/** The prompt limit of the design route body. The field stops there, so a long brief never gets a 400. */
const DESIGN_PROMPT_MAX_LENGTH =
	designAppThemeBodySchema.shape.prompt.maxLength ?? undefined;

/** The choices of the Font row: the look font, then the body faces. */
const FONT_CHOICES = ["look", ...APP_BODY_FONT_IDS] as const;
/** The choices of the Display font row: the look font, then the display and the body faces. */
const DISPLAY_FONT_CHOICES = ["look", ...APP_DISPLAY_FONT_IDS] as const;
/** The display faces first: a heading face is the usual pick of this row. */
const DISPLAY_FONT_GROUPS = [
	APP_DISPLAY_FONT_IDS.filter((id) => APP_FONTS[id].role === "display"),
	APP_DISPLAY_FONT_IDS.filter((id) => APP_FONTS[id].role === "body"),
] as const;

/** The sheet. It never boots a sandbox: Save answers PREVIEW_NOT_RUNNING when the preview is off. */
export default function ThemeSheet({
	projectId,
	open,
	onClose,
	saved,
	draft,
	onDraftChange,
	isReadOnly,
}: ThemeSheetProps) {
	const { t, locale } = useTranslation();
	const save = useSaveAppTheme(projectId);
	const design = useDesignAppTheme(projectId);
	const current = draft ?? saved.theme;
	const { selection } = current;
	const palette = current.resolved[selection.mode];
	const saveError =
		save.error === null ? null : saveErrorText(save.error, draft !== null, t);
	const designError =
		design.error === null ? null : designErrorText(design.error, t);
	// The controls lock during a save and during a design. A change then would be lost under the answer.
	const isLocked = isReadOnly || save.isPending || design.isPending;
	const [prompt, setPrompt] = useState("");
	const designHintId = useId();
	const canDesign = !isLocked && prompt.trim() !== "";
	// The industry of the Look row filter. "all" shows every look.
	const [industry, setIndustry] = useState<AppThemeCategory | "all">("all");
	// A family with no look of the industry hides.
	// `some` and not `includes`: each look keeps its own literal `fits` list, so on their union `includes` takes `never`.
	const shownFamilies = LOOKS_BY_FAMILY.map(({ family, lookIds }) => ({
		family,
		lookIds: lookIds.filter(
			(id) =>
				industry === "all" ||
				APP_LOOKS[id].fits.some((fit) => fit === industry),
		),
	})).filter(({ lookIds }) => lookIds.length > 0);
	// The look of the selection. A world or a seeds source has none.
	const selectedLook =
		selection.source.kind === "look" ? selection.source.look : undefined;
	// The Look select trigger: the resolved palette with the primary of the user, and the theme name.
	const currentTheme = (
		<>
			<LookPreview palette={palette} />
			<span dir="auto" className="truncate">
				{current.name}
			</span>
		</>
	);

	// A close drops the draft, so a reopen must not show the error of its last save.
	// A pending save settles first: its success still clears the draft and shows the toast.
	useEffect(() => {
		if (!open && !save.isPending) save.reset();
	}, [open, save.isPending, save.reset]);

	// A close or a turn drops the draft. A design that ends after it must not make a draft or a toast.
	// The reset removes the success callback of the pending design. The credits still refetch.
	useEffect(() => {
		if (!open || isReadOnly) design.reset();
	}, [open, isReadOnly, design.reset]);

	function applySelection(next: AppThemeSelection) {
		// A new change makes the errors of the last save and of the last design old.
		save.reset();
		design.reset();
		let file: AppThemeFile;
		try {
			file = buildAppThemeFile({
				selection: next,
				origin: "user",
				world: saved.world ?? undefined,
				// The same source keeps the name, for example a name of the AI designer, after a radius change.
				// A new source takes its default name: the look name, the world name, or "Brand colors".
				name: isSameThemeSource(selection.source, next.source)
					? current.name
					: undefined,
			});
		} catch (error) {
			// Only a world source without its world card throws. The GET sends the card, so this is a server bug.
			Sentry.captureException(error, {
				tags: { source: "theme-sheet" },
				extra: { sourceKind: next.source.kind },
			});
			toast.error(t("errors.generic"));
			return;
		}
		onDraftChange(file);
	}

	const change = (patch: Partial<AppThemeSelection>) =>
		applySelection({ ...selection, ...patch });

	function pickLook(lookId: AppLookId) {
		const { defaults } = APP_LOOKS[lookId];
		// A look shows as designed, as its icon in the Look select: its mode, colors, fonts, corners, border, and shadow.
		// The layout stays. coherentSelection fixes a layout value that clashes with the new mode, as a contrast sidebar on a dark page.
		applySelection(
			coherentSelection({
				...selection,
				source: { kind: "look", look: lookId },
				mode: defaults.mode,
				primary: "look",
				font: "look",
				displayFont: "look",
				radius: defaults.radius,
				border: defaults.border,
				shadow: defaults.shadow,
				shadowStyle: defaults.shadowStyle,
			}),
		);
	}

	function saveDraft() {
		if (draft === null) return;
		// Only a seeds theme (from the AI designer or a brand) has its own name. A look or a world keeps its catalog name.
		// The PUT refuses control characters, which the file schema allows. The server then writes "Brand colors".
		const name =
			draft.selection.source.kind === "seeds" &&
			appThemeNameSchema.safeParse(draft.name).success
				? draft.name
				: undefined;
		save.mutate(
			{ selection: draft.selection, expectedHeadSha: saved.headSha, name },
			{
				onSuccess: (answer) => {
					onDraftChange(null);
					toast.success(
						t("appBuilder.theme.saved", { name: answer.theme.name }),
					);
				},
			},
		);
	}

	function designTheme() {
		if (!canDesign) return;
		// A new design makes the error of the last save old. The new mutation clears the old design error.
		save.reset();
		design.mutate(
			{
				prompt: prompt.trim(),
				current: { name: current.name, selection },
			},
			{
				onSuccess: (answer) => {
					// The field keeps its text, so the user can edit the brief and generate again.
					onDraftChange(answer.theme);
					toast.success(
						t("appBuilder.theme.design.designed", { name: answer.theme.name }),
					);
				},
			},
		);
	}

	function onPromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		// Cmd+Enter or Ctrl+Enter generates. A plain Enter writes a new line. Enter that ends an IME composition does nothing.
		if (
			event.key !== "Enter" ||
			!(event.metaKey || event.ctrlKey) ||
			event.nativeEvent.isComposing
		) {
			return;
		}
		event.preventDefault();
		designTheme();
	}

	const resolvedPrimary = parseColor(palette.primary);
	// The resolver writes only valid colors, so the black fallback never shows.
	const resolvedPrimaryHex =
		resolvedPrimary === null ? "#000000" : toHex(resolvedPrimary);

	return (
		<Sheet
			open={open}
			modal={false}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
		>
			<SheetContent
				side="right"
				closeLabel={t("appBuilder.theme.close")}
				// The preview stays usable: a click in the app or in the builder keeps the sheet open.
				onInteractOutside={(event) => event.preventDefault()}
				className="gap-0 bg-white p-0 dark:bg-sand"
			>
				<SheetHeader className="gap-1 border-night/[0.07] border-b px-5 pt-5 pb-4 dark:border-white/[0.07]">
					<SheetTitle className="font-grotesk text-[17px] text-night dark:text-foreground">
						{t("appBuilder.theme.title")}
					</SheetTitle>
					<SheetDescription className="text-[13px] text-night/60 dark:text-foreground/60">
						{t("appBuilder.theme.description")}
					</SheetDescription>
					<p className="mt-1 flex items-center gap-2 font-grotesk font-medium text-[12.5px] text-night/70 dark:text-foreground/70">
						<span dir="auto" className="truncate">
							{current.name}
						</span>
						{draft !== null ? (
							<span className="inline-flex shrink-0 items-center gap-1.5 text-ember-text">
								<span aria-hidden className="size-1.5 rounded-full bg-ember" />
								{t("appBuilder.theme.unsaved")}
							</span>
						) : null}
					</p>
				</SheetHeader>
				{isReadOnly ? (
					<p
						role="status"
						className="mx-5 mt-4 rounded-[14px] bg-spark/[0.14] px-3.5 py-2.5 font-grotesk text-[12.5px] text-night leading-snug dark:text-foreground"
					>
						{t("appBuilder.theme.turnRunning")}
					</p>
				) : null}
				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
					{/* A disabled fieldset disables every control inside it, also the segmented groups. */}
					{/* The controls also lock during a save and a design. A change resets the save, and then its success never runs. */}
					<fieldset
						disabled={isLocked}
						className={cn(
							"flex min-w-0 flex-col gap-5 transition-opacity",
							isReadOnly && "opacity-55",
						)}
					>
						<div className="rounded-[18px] border border-night/[0.08] bg-night/[0.02] p-3.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
							<Row label={t("appBuilder.theme.design.label")}>
								<Textarea
									aria-label={t("appBuilder.theme.design.label")}
									aria-describedby={designHintId}
									// The user writes the brief in any language.
									dir="auto"
									rows={3}
									value={prompt}
									maxLength={DESIGN_PROMPT_MAX_LENGTH}
									placeholder={t("appBuilder.theme.design.placeholder")}
									onChange={(event) => setPrompt(event.target.value)}
									onKeyDown={onPromptKeyDown}
									className={cn(
										PANEL_INPUT_CLASS,
										"h-auto max-h-40 min-h-20 resize-none rounded-[16px] py-2.5 text-[13px] leading-snug md:text-[13px]",
									)}
								/>
								<div className="flex flex-wrap gap-1.5">
									{DESIGN_EXAMPLES.map((example) => {
										const brief = t(
											`appBuilder.theme.design.examples.${example}`,
										);
										return (
											<button
												key={example}
												type="button"
												onClick={() => setPrompt(brief)}
												className="rounded-full border border-night/[0.1] bg-white px-2.5 py-1 font-grotesk font-medium text-[11.5px] text-night/70 outline-none transition-colors duration-150 hover:border-night/25 hover:text-night focus-visible:ring-2 focus-visible:ring-ember/30 dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-foreground/70 dark:hover:border-white/30 dark:hover:text-foreground"
											>
												{brief}
											</button>
										);
									})}
								</div>
								<Button
									disabled={!canDesign}
									onClick={designTheme}
									className={cn(PANEL_PRIMARY_BUTTON_CLASS, "mt-1")}
								>
									<SparkleIcon aria-hidden weight="fill" />
									{design.isPending
										? t("appBuilder.theme.design.generating")
										: t("appBuilder.theme.design.generate")}
								</Button>
								<p
									id={designHintId}
									className="text-[12px] text-night/50 leading-snug dark:text-foreground/50"
								>
									{t("appBuilder.theme.design.hint")}
								</p>
								{designError !== null ? (
									<p
										role="alert"
										className="font-sans text-[12.5px] text-destructive leading-snug"
									>
										{designError}
									</p>
								) : null}
							</Row>
						</div>
						<Row label={t("appBuilder.theme.fields.look")}>
							<Select
								value={industry}
								// The fieldset does not lock a Radix Select. Radix opens it on pointerdown, and its list is a portal.
								disabled={isLocked}
								onValueChange={(value) =>
									setIndustry(
										INDUSTRY_FILTERS.find((category) => category === value) ??
											"all",
									)
								}
							>
								<SelectTrigger
									aria-label={t("appBuilder.theme.industry")}
									className={SELECT_TRIGGER_CLASS}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent position="popper">
									<SelectItem value="all">
										{t("appBuilder.theme.allIndustries")}
									</SelectItem>
									{INDUSTRY_FILTERS.map((category) => (
										<SelectItem key={category} value={category}>
											{t(`appBuilder.theme.categories.${category}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select
								// A world or a seeds theme has no look: the empty value shows the placeholder.
								value={selectedLook ?? ""}
								disabled={isLocked}
								onValueChange={(value) => {
									const lookId = APP_LOOK_IDS.find((id) => id === value);
									if (lookId !== undefined) pickLook(lookId);
								}}
							>
								<SelectTrigger
									aria-label={t("appBuilder.theme.fields.look")}
									className={cn(SELECT_TRIGGER_CLASS, "h-11 ps-2")}
								>
									{/* The trigger draws the theme on screen itself: its look can be outside the industry filter, */}
									{/* and a world or a seeds theme has no item. */}
									<SelectValue placeholder={currentTheme}>
										{currentTheme}
									</SelectValue>
								</SelectTrigger>
								<SelectContent
									position="popper"
									className="max-h-[min(28rem,var(--radix-select-content-available-height))]"
								>
									{shownFamilies.map(({ family, lookIds }) => (
										<SelectGroup key={family}>
											<SelectLabel>
												{t(`appBuilder.theme.families.${family}`)}
											</SelectLabel>
											{lookIds.map((lookId) => (
												<SelectItem key={lookId} value={lookId}>
													<LookPreview
														palette={
															APP_LOOKS[lookId].palette[
																APP_LOOKS[lookId].defaults.mode
															]
														}
													/>
													{APP_LOOKS[lookId].name}
												</SelectItem>
											))}
										</SelectGroup>
									))}
								</SelectContent>
							</Select>
						</Row>
						<SegmentRow
							label={t("appBuilder.theme.fields.mode")}
							value={selection.mode}
							values={APP_THEME_OPTIONS.mode}
							labelOf={(mode) => t(`appBuilder.theme.options.mode.${mode}`)}
							onChange={(mode) => change({ mode })}
						/>
						<Row label={t("appBuilder.theme.fields.primary")}>
							<div className="flex flex-wrap gap-1">
								<ColorDot
									color={lookPrimaryOf(selection, saved.world, palette.primary)}
									label={t("appBuilder.theme.fromLook")}
									isSelected={selection.primary === "look"}
									onClick={() => change({ primary: "look" })}
								/>
								{APP_THEME_OPTIONS.hue.map((hue) => (
									<ColorDot
										key={hue}
										color={APP_HUES[hue][selection.mode]}
										label={t(`appBuilder.theme.hues.${hue}`)}
										isSelected={selection.primary === hue}
										onClick={() => change({ primary: hue })}
									/>
								))}
							</div>
							<BrandColorField
								primary={selection.primary}
								pickerHex={brandHexOf(selection.primary) ?? resolvedPrimaryHex}
								onChange={(primary) => change({ primary })}
							/>
						</Row>
						<Row label={t("appBuilder.theme.fields.font")}>
							<Select
								value={selection.font}
								// The fieldset does not lock a Radix Select. Radix opens it on pointerdown, and its list is a portal.
								disabled={isLocked}
								onValueChange={(value) => {
									const font = FONT_CHOICES.find((choice) => choice === value);
									if (font !== undefined) change({ font });
								}}
							>
								<SelectTrigger
									aria-label={t("appBuilder.theme.fields.font")}
									className={SELECT_TRIGGER_CLASS}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent position="popper">
									<SelectItem value="look">
										{t("appBuilder.theme.fromLook")}
									</SelectItem>
									{APP_BODY_FONT_IDS.map((id) => (
										<SelectItem key={id} value={id}>
											{APP_FONTS[id].family}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Row>
						<Row label={t("appBuilder.theme.fields.displayFont")}>
							<Select
								value={selection.displayFont}
								disabled={isLocked}
								onValueChange={(value) => {
									const displayFont = DISPLAY_FONT_CHOICES.find(
										(choice) => choice === value,
									);
									if (displayFont !== undefined) change({ displayFont });
								}}
							>
								<SelectTrigger
									aria-label={t("appBuilder.theme.fields.displayFont")}
									className={SELECT_TRIGGER_CLASS}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent position="popper">
									<SelectItem value="look">
										{t("appBuilder.theme.fromLook")}
									</SelectItem>
									{DISPLAY_FONT_GROUPS.map((ids, index) => (
										<SelectGroup key={ids[0] ?? index}>
											<SelectLabel>
												{t(
													index === 0
														? "appBuilder.theme.fontGroups.display"
														: "appBuilder.theme.fontGroups.body",
												)}
											</SelectLabel>
											{ids.map((id) => (
												<SelectItem key={id} value={id}>
													{APP_FONTS[id].family}
												</SelectItem>
											))}
										</SelectGroup>
									))}
								</SelectContent>
							</Select>
						</Row>
						<SegmentRow
							label={t("appBuilder.theme.fields.scale")}
							value={selection.scale}
							values={APP_THEME_OPTIONS.scale}
							labelOf={(scale) => t(`appBuilder.theme.options.scale.${scale}`)}
							onChange={(scale) => change({ scale })}
						/>
						<SegmentRow
							label={t("appBuilder.theme.fields.radius")}
							value={selection.radius}
							values={APP_THEME_OPTIONS.radius}
							labelOf={(radius) =>
								t(`appBuilder.theme.options.radius.${radius}`)
							}
							onChange={(radius) => change({ radius })}
						/>
						<SegmentRow
							label={t("appBuilder.theme.fields.border")}
							value={selection.border}
							values={APP_THEME_OPTIONS.border}
							// The values are px widths. Intl writes the decimal mark of the locale, for example 1,5 in French.
							labelOf={(border) =>
								t("appBuilder.theme.borderValue", {
									value: formatNumber(Number(border), locale),
								})
							}
							onChange={(border) => change({ border })}
						/>
						<SegmentRow
							label={t("appBuilder.theme.fields.shadow")}
							value={selection.shadow}
							values={APP_THEME_OPTIONS.shadow}
							labelOf={(shadow) =>
								t(`appBuilder.theme.options.shadow.${shadow}`)
							}
							onChange={(shadow) => change({ shadow })}
						/>
						<SegmentRow
							label={t("appBuilder.theme.fields.shadowStyle")}
							value={selection.shadowStyle}
							values={APP_THEME_OPTIONS.shadowStyle}
							labelOf={(shadowStyle) =>
								t(`appBuilder.theme.options.shadowStyle.${shadowStyle}`)
							}
							onChange={(shadowStyle) => change({ shadowStyle })}
						/>
						<SegmentRow
							label={t("appBuilder.theme.fields.content")}
							value={selection.content}
							values={APP_THEME_OPTIONS.content}
							labelOf={(content) =>
								t(`appBuilder.theme.options.content.${content}`)
							}
							onChange={(content) => change({ content })}
						/>
						<SegmentRow
							label={t("appBuilder.theme.fields.sidebarStyle")}
							value={selection.sidebarStyle}
							values={APP_THEME_OPTIONS.sidebarStyle}
							labelOf={(sidebarStyle) =>
								t(`appBuilder.theme.options.sidebarStyle.${sidebarStyle}`)
							}
							onChange={(sidebarStyle) => change({ sidebarStyle })}
						/>
						<SegmentRow
							label={t("appBuilder.theme.fields.sidebarCollapse")}
							value={selection.sidebarCollapse}
							values={APP_THEME_OPTIONS.sidebarCollapse}
							labelOf={(sidebarCollapse) =>
								t(`appBuilder.theme.options.sidebarCollapse.${sidebarCollapse}`)
							}
							onChange={(sidebarCollapse) => change({ sidebarCollapse })}
						/>
						<SegmentRow
							label={t("appBuilder.theme.fields.sidebarStart")}
							value={selection.sidebarStart}
							values={APP_THEME_OPTIONS.sidebarStart}
							labelOf={(sidebarStart) =>
								t(`appBuilder.theme.options.sidebarStart.${sidebarStart}`)
							}
							onChange={(sidebarStart) => change({ sidebarStart })}
						/>
						<SegmentRow
							label={t("appBuilder.theme.fields.sidebarTone")}
							value={selection.sidebarTone}
							values={APP_THEME_OPTIONS.sidebarTone}
							labelOf={(sidebarTone) =>
								t(`appBuilder.theme.options.sidebarTone.${sidebarTone}`)
							}
							onChange={(sidebarTone) => change({ sidebarTone })}
						/>
						<SegmentRow
							label={t("appBuilder.theme.fields.activeItem")}
							value={selection.activeItem}
							values={APP_THEME_OPTIONS.activeItem}
							labelOf={(activeItem) =>
								t(`appBuilder.theme.options.activeItem.${activeItem}`)
							}
							onChange={(activeItem) => change({ activeItem })}
						/>
						<SegmentRow
							label={t("appBuilder.theme.fields.header")}
							value={selection.header}
							values={APP_THEME_OPTIONS.header}
							labelOf={(header) =>
								t(`appBuilder.theme.options.header.${header}`)
							}
							onChange={(header) => change({ header })}
						/>
						<SegmentRow
							label={t("appBuilder.theme.fields.userMenu")}
							value={selection.userMenu}
							values={APP_THEME_OPTIONS.userMenu}
							labelOf={(userMenu) =>
								t(`appBuilder.theme.options.userMenu.${userMenu}`)
							}
							onChange={(userMenu) => change({ userMenu })}
						/>
						<SegmentRow
							label={t("appBuilder.theme.fields.frame")}
							value={selection.frame}
							values={APP_THEME_OPTIONS.frame}
							labelOf={(frame) => t(`appBuilder.theme.options.frame.${frame}`)}
							onChange={(frame) => change({ frame })}
						/>
						<Row label={t("appBuilder.theme.fields.icons")}>
							{/* Six segments do not fit the sheet: "Duotone" needs 51px, and one segment gives 46px. */}
							<Select
								value={selection.icons}
								// The fieldset does not lock a Radix Select. Radix opens it on pointerdown, and its list is a portal.
								disabled={isLocked}
								onValueChange={(value) => {
									const icons = APP_THEME_OPTIONS.icons.find(
										(option) => option === value,
									);
									if (icons !== undefined) change({ icons });
								}}
							>
								<SelectTrigger
									aria-label={t("appBuilder.theme.fields.icons")}
									className={SELECT_TRIGGER_CLASS}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent position="popper">
									{APP_THEME_OPTIONS.icons.map((icons) => (
										<SelectItem key={icons} value={icons}>
											{t(`appBuilder.theme.options.icons.${icons}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Row>
						<SegmentRow
							label={t("appBuilder.theme.fields.navIcon")}
							value={selection.navIcon}
							values={APP_THEME_OPTIONS.navIcon}
							labelOf={(navIcon) =>
								t(`appBuilder.theme.options.navIcon.${navIcon}`)
							}
							onChange={(navIcon) => change({ navIcon })}
						/>
					</fieldset>
				</div>
				<SheetFooter className="gap-2 border-night/[0.07] border-t px-5 py-4 dark:border-white/[0.07]">
					{saveError !== null ? (
						<p
							role="alert"
							className="font-sans text-[12.5px] text-destructive leading-snug"
						>
							{saveError}
						</p>
					) : null}
					<div className="flex gap-2">
						<Button
							variant="outline"
							disabled={isLocked}
							onClick={() => applySelection(randomSelection(Math.random))}
							className={cn(PANEL_SECONDARY_BUTTON_CLASS, "flex-1")}
						>
							<ShuffleIcon aria-hidden weight="bold" />
							{t("appBuilder.theme.random")}
						</Button>
						<Button
							variant="outline"
							disabled={isLocked || draft === null}
							onClick={() => {
								save.reset();
								design.reset();
								onDraftChange(null);
							}}
							className={cn(PANEL_SECONDARY_BUTTON_CLASS, "flex-1")}
						>
							<ArrowCounterClockwiseIcon aria-hidden weight="bold" />
							{t("appBuilder.theme.reset")}
						</Button>
					</div>
					<Button
						disabled={isLocked || draft === null}
						onClick={saveDraft}
						className={PANEL_PRIMARY_BUTTON_CLASS}
					>
						{save.isPending
							? t("appBuilder.theme.saving")
							: t("appBuilder.theme.save")}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

/** The pill trigger of the selects of the sheet, in the look of the panel fields. */
const SELECT_TRIGGER_CLASS =
	"h-9 w-full rounded-full border-night/[0.12] bg-white px-4 font-grotesk font-medium text-[13px] shadow-none dark:border-white/[0.12] dark:bg-white/[0.04]";

/**
 * The clear message of a failed save, or null. The 409 codes of the theme PUT get the words of the sheet.
 * `hasDraft` is false when the draft is gone: a close, a turn, or a new saved theme dropped it.
 */
function saveErrorText(
	error: Error,
	hasDraft: boolean,
	t: ReturnType<typeof useTranslation>["t"],
): string | null {
	if (!hasDraft) {
		// The THEME_HEAD_MOVED refetch drops the draft when another place saved a different theme. The user must know.
		// Any other dropped draft has nothing to save again, so the error of its last save goes too.
		return isApiClientError(error) && error.code === "THEME_HEAD_MOVED"
			? t("appBuilder.theme.errors.changedElsewhere")
			: null;
	}
	if (isApiClientError(error)) {
		switch (error.code) {
			case "BUILDER_TURN_RUNNING":
				return t("appBuilder.theme.errors.turnRunning");
			case "BUILDER_TURN_WAITING":
				return t("appBuilder.theme.errors.turnWaiting");
			case "PREVIEW_NOT_RUNNING":
				return t("appBuilder.theme.errors.previewNotRunning");
			case "THEME_HEAD_MOVED":
				return t("appBuilder.theme.errors.headMoved");
		}
	}
	return getApiErrorMessage(error);
}

/**
 * The clear message of a failed design. The two codes of the design route get the words of the sheet.
 * Any other error gets the shared API message. A 402 also opens the billing modal in BaseService.
 */
function designErrorText(
	error: Error,
	t: ReturnType<typeof useTranslation>["t"],
): string {
	if (isApiClientError(error)) {
		switch (error.code) {
			case "THEME_DESIGN_FAILED":
				return t("appBuilder.theme.design.errors.failed");
			case "THEME_DESIGN_UNAVAILABLE":
				return t("appBuilder.theme.design.errors.unavailable");
		}
	}
	return getApiErrorMessage(error);
}

/**
 * The swatch of the "look" primary: the primary of the look, the accent of the world, or the
 * primary seed. `fallback` is the resolved primary, for a world source without its world card.
 */
function lookPrimaryOf(
	selection: AppThemeSelection,
	world: GetAppThemeResponse["world"],
	fallback: string,
): string {
	const { source } = selection;
	switch (source.kind) {
		case "look":
			return APP_LOOKS[source.look].palette[selection.mode].primary;
		case "world":
			return world?.preview.accent ?? fallback;
		case "seeds":
			return source.primary;
	}
}

/** One labeled row of the sheet. Each control carries the label as its accessible name too. */
function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-2">
			<p className="font-grotesk font-semibold text-[13px] text-night dark:text-foreground">
				{label}
			</p>
			{children}
		</div>
	);
}

/** A row of one segmented group. The segments share the width, as in the reference sheets. */
function SegmentRow<Value extends string>({
	label,
	value,
	values,
	labelOf,
	onChange,
}: {
	label: string;
	value: Value;
	/** The options of the field, in APP_THEME_OPTIONS order. */
	values: readonly Value[];
	/** The shown text of one option. */
	labelOf: (value: Value) => string;
	onChange: (value: Value) => void;
}) {
	return (
		<Row label={label}>
			<SegmentedControl
				ariaLabel={label}
				value={value}
				onChange={onChange}
				options={values.map((option) => ({
					value: option,
					label: labelOf(option),
				}))}
				// Five segments must fit the sheet, so each one shrinks its padding and its text.
				className="w-full *:min-w-0 *:flex-1 *:justify-center *:px-1 *:text-[12.5px]"
			/>
		</Row>
	);
}

/**
 * The icon of one look in the Look select: a small screen of the palette (canvas, a card, a text
 * line, and a primary bar). Spans only, because Radix puts it inside the item text span.
 */
function LookPreview({
	palette,
}: {
	/** The palette of the current mode: a catalog look, or the resolved palette of a world or seeds theme. */
	palette: AppThemePalette;
}) {
	return (
		<span
			aria-hidden
			className="flex h-[26px] w-9 shrink-0 rounded-[7px] border border-night/[0.12] p-[3px] dark:border-white/[0.14]"
			style={{ background: palette.canvas }}
		>
			<span
				className="flex flex-1 flex-col justify-between rounded-[4px] px-[3px] py-[3px]"
				style={{
					background: palette.card,
					border: `1px solid ${palette.border}`,
				}}
			>
				<span
					className="block h-[2px] w-3/5 rounded-full"
					style={{ background: palette.foreground }}
				/>
				<span
					className="block h-[4px] w-1/2 rounded-full"
					style={{ background: palette.primary }}
				/>
			</span>
		</span>
	);
}

/** One dot of the Primary row. The tooltip names the color. */
function ColorDot({
	color,
	label,
	isSelected,
	onClick,
}: {
	/** A CSS color: a hex or an oklch() of the catalog. */
	color: string;
	label: string;
	isSelected: boolean;
	onClick: () => void;
}) {
	return (
		<IconAction label={label}>
			<button
				type="button"
				aria-pressed={isSelected}
				onClick={onClick}
				className={cn(
					"grid size-7 place-items-center rounded-full border-2 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ember/30",
					isSelected
						? "border-night dark:border-foreground"
						: "border-transparent hover:border-night/20 dark:hover:border-white/25",
				)}
			>
				<span
					aria-hidden
					className="size-5 rounded-full border border-black/10"
					style={{ background: color }}
				/>
			</button>
		</IconAction>
	);
}

/**
 * The brand color of the Primary row: the native color picker and a hex field. A valid hex
 * applies at once; other text shows the error line and changes nothing.
 */
function BrandColorField({
	primary,
	pickerHex,
	onChange,
}: {
	/** The primary of the selection: "look", a hue id, or a brand hex. */
	primary: AppThemeSelection["primary"];
	/** The `#rrggbb` of the picker: the brand hex, or the resolved primary of the theme. */
	pickerHex: string;
	onChange: (primary: `#${string}`) => void;
}) {
	const { t } = useTranslation();
	const inputId = useId();
	const hintId = useId();
	const brandHex = brandHexOf(primary);
	const [text, setText] = useState(brandHex ?? "");
	const [shownPrimary, setShownPrimary] = useState(primary);
	// A dot, Random, Reset, or the picker changes the primary. The field then shows the new brand hex, or nothing.
	if (primary !== shownPrimary) {
		setShownPrimary(primary);
		setText(brandHex ?? "");
	}
	const isInvalid = text.trim() !== "" && brandHexOf(text) === null;

	function applyText(next: string) {
		setText(next);
		const hex = brandHexOf(next);
		if (hex !== null) onChange(hex);
	}

	return (
		<div className="mt-1.5">
			<label
				htmlFor={inputId}
				className="font-grotesk font-medium text-[12.5px] text-night/65 dark:text-foreground/65"
			>
				{t("appBuilder.theme.brandColor")}
			</label>
			<div className="mt-1.5 flex items-center gap-2">
				<span
					className="relative size-9 shrink-0 rounded-full border border-night/[0.12] focus-within:ring-2 focus-within:ring-ember/30 dark:border-white/[0.12]"
					style={{ background: pickerHex }}
				>
					<input
						type="color"
						aria-label={t("appBuilder.theme.brandColorPicker")}
						value={pickerHex}
						onChange={(event) => applyText(event.target.value)}
						className="absolute inset-0 size-full cursor-pointer rounded-full opacity-0"
					/>
				</span>
				<Input
					id={inputId}
					// A hex reads left to right in every locale.
					dir="ltr"
					value={text}
					placeholder="#1f6098"
					spellCheck={false}
					autoComplete="off"
					aria-invalid={isInvalid}
					aria-describedby={hintId}
					onChange={(event) => applyText(event.target.value)}
					className={cn(PANEL_INPUT_CLASS, "h-9 font-mono text-[13px]")}
				/>
			</div>
			<p
				id={hintId}
				className={cn(
					"mt-1.5 text-[12px] leading-snug",
					isInvalid
						? "text-destructive"
						: "text-night/50 dark:text-foreground/50",
				)}
			>
				{t(
					isInvalid
						? "appBuilder.theme.brandColorInvalid"
						: "appBuilder.theme.brandColorHint",
				)}
			</p>
		</div>
	);
}
