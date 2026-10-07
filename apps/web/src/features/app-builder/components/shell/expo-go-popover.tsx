/**
 * "Test on your phone": the Expo Go QR of a mobile project (WANDIT-193).
 * ExpoGoPanel mints the phone link and renders ExpoGoLinkBody. The mobile
 * stage of components/preview/phone-preview.tsx shows the panel as a column
 * next to the phone, or, on a narrow stage, in ExpoGoPopover behind the QR
 * button of its bar. The publish popover shows the panel after "Show QR".
 * Mints through useMintPhonePreviewLink; ExpoGoLinkBody is pure, and the
 * spec renders it.
 */

import { ArrowClockwiseIcon } from "@phosphor-icons/react/ArrowClockwise";
import { CaretDownIcon } from "@phosphor-icons/react/CaretDown";
import { CopyIcon } from "@phosphor-icons/react/Copy";
import { MoonStarsIcon } from "@phosphor-icons/react/MoonStars";
import { QrCodeIcon } from "@phosphor-icons/react/QrCode";
import { expoUsernameSchema } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { Label } from "@wandit/ui/components/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@wandit/ui/components/popover";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { useMintPhonePreviewLink } from "../../api/app-builder.mutations";
import { EXPO_GO_SDK_VERSION, EXPO_GO_STORE_LINKS } from "../../lib/constants";
import {
	copyToClipboard,
	readExpoUsername,
	writeExpoUsername,
} from "../../lib/helpers";
import type { PreviewTokenState } from "../../lib/use-preview-token";
import { IconAction, TOOLBAR_ICON_BUTTON_CLASS } from "./top-bar";

/** Props of the Expo Go panel and its popover. PhonePreview and the publish popover pass them. */
export type ExpoGoPanelProps = {
	/** The open mobile project. Its id mints the phone link. */
	projectId: string;
	/**
	 * Status of the preview token mint, from usePreviewToken in PhonePreview.
	 * The phone link needs a running sandbox, so only `ready` and `blocked` mint it. The
	 * publish popover has no status and passes none: the panel mints at once,
	 * and a sleeping sandbox answers SANDBOX_NOT_RUNNING.
	 */
	previewStatus?: PreviewTokenState["status"];
	/** Mints the preview token again (usePreviewToken `refresh`). The retry of a failed preview calls it. PhonePreview passes it with `previewStatus`. */
	onRetryPreview?: () => void;
};

/** The QR button of the stage bar; the content mounts on each open. PhonePreview shows it only while the QR column is hidden. */
export function ExpoGoPopover(props: ExpoGoPanelProps) {
	const { t } = useTranslation();

	return (
		<Popover>
			<IconAction label={t("appBuilder.expoGo.title")}>
				<PopoverTrigger asChild>
					<Button
						variant="ghost"
						size="icon-sm"
						className={TOOLBAR_ICON_BUTTON_CLASS}
					>
						<QrCodeIcon aria-hidden weight="bold" />
					</Button>
				</PopoverTrigger>
			</IconAction>
			{/* 320 px holds the QR and the username row. On a phone it keeps 12 px from each edge. */}
			<PopoverContent
				align="end"
				className="w-[320px] max-w-[calc(100vw-24px)] p-4"
			>
				{/* Radix mounts the content on each open, so each open mints a new link. */}
				<ExpoGoPanel {...props} />
			</PopoverContent>
		</Popover>
	);
}

/**
 * Holds the username and the mint. It mints when the app starts to run and
 * on a username change, never while the app sleeps: the link needs a sandbox.
 * Without a preview status (the publish popover, after "Show QR"), each
 * mount mints a new link.
 */
export function ExpoGoPanel({
	projectId,
	previewStatus,
	onRetryPreview,
}: ExpoGoPanelProps) {
	const { t } = useTranslation();
	// The publish popover knows no preview status, so it mints at once like a running app.
	// A blocked frame cookie does not stop the phone: Expo Go needs no cookie.
	const isAppRunning =
		previewStatus === undefined ||
		previewStatus === "ready" ||
		previewStatus === "blocked";
	const [expoUsername, setExpoUsername] = useState(readExpoUsername);
	// A new mutate resets `data` and `error`, so a pending mint reads as neither.
	const { mutate, data: link, error } = useMintPhonePreviewLink(projectId);
	// The expoUrl whose expiry passed. A new link has another URL, so this needs no reset.
	const [expiredUrl, setExpiredUrl] = useState<string | null>(null);

	useEffect(() => {
		if (!isAppRunning) return;
		mutate(expoUsername);
	}, [mutate, expoUsername, isAppRunning]);

	useEffect(() => {
		if (link === undefined) return;
		const timerId = setTimeout(
			() => setExpiredUrl(link.expoUrl),
			Math.max(Date.parse(link.expiresAt) - Date.now(), 0),
		);
		return () => clearTimeout(timerId);
	}, [link]);

	// Each preview status has its own QR state. A `loading` preview and a
	// running mint keep the skeleton. A link minted before the app slept
	// points to a stopped sandbox, so only a `ready` or `blocked` preview shows it.
	let state: ExpoGoLinkState = { status: "pending" };
	if (previewStatus === "waking") {
		state = { status: "asleep" };
	} else if (previewStatus === "error") {
		state = { status: "previewFailed" };
	} else if (error !== null) {
		state = {
			status: "error",
			// The phone link needs a running sandbox, like the preview frame.
			message:
				isApiClientError(error) && error.code === "SANDBOX_NOT_RUNNING"
					? t("appBuilder.expoGo.notRunning")
					: getApiErrorMessage(error),
		};
	} else if (link !== undefined) {
		state = {
			status: "ready",
			expoUrl: link.expoUrl,
			isExpired: link.expoUrl === expiredUrl,
		};
	}

	return (
		<ExpoGoLinkBody
			link={state}
			expoUsername={expoUsername}
			onSaveUsername={(next) => {
				writeExpoUsername(next);
				setExpoUsername(next);
			}}
			onRefresh={
				previewStatus === "error" && onRetryPreview !== undefined
					? onRetryPreview
					: () => mutate(expoUsername)
			}
		/>
	);
}

/**
 * State of the QR area as the body shows it. `pending` covers the preview
 * mint and the phone link mint. `asleep`: the app does not run, so no mint
 * happens. `previewFailed`: the preview token mint failed. `error`: the
 * phone link mint failed.
 */
export type ExpoGoLinkState =
	| { status: "asleep" }
	| { status: "pending" }
	| { status: "previewFailed" }
	| { status: "ready"; expoUrl: string; isExpired: boolean }
	| { status: "error"; message: string };

/** Props of the pure body. ExpoGoPanel passes them, and the spec renders the body with fakes. */
export type ExpoGoLinkBodyProps = {
	/** The QR area state from ExpoGoPanel. `ready` carries the `exps://` URL of the phone link. */
	link: ExpoGoLinkState;
	/** Expo Go account for the iPhone, from localStorage. "" when the user typed none. */
	expoUsername: string;
	/** Stores a new username, "" included. The panel then mints a new link with it. */
	onSaveUsername: (expoUsername: string) => void;
	/** Retries the failed step: the preview mint on `previewFailed`, else a new phone link. The retry and new-link buttons call it. */
	onRefresh: () => void;
};

/** The title, the QR area, the account row, the store line, and the help notes. The column and the popover share it. */
export function ExpoGoLinkBody({
	link,
	expoUsername,
	onSaveUsername,
	onRefresh,
}: ExpoGoLinkBodyProps) {
	const { t } = useTranslation();

	return (
		<div className="flex flex-col gap-4">
			<h3 className="font-grotesk font-semibold text-[18px] text-night leading-tight tracking-[-0.01em] dark:text-foreground">
				{t("appBuilder.expoGo.title")}
			</h3>
			<LinkArea link={link} onRefresh={onRefresh} />
			<p className="font-sans text-[14px] text-night/60 leading-snug dark:text-foreground/60">
				{t("appBuilder.expoGo.scanHint")}
			</p>
			<UsernameRow expoUsername={expoUsername} onSave={onSaveUsername} />
			<p className="font-sans text-[12.5px] text-night/50 leading-relaxed dark:text-foreground/50">
				{t("appBuilder.expoGo.sdk", { sdk: String(EXPO_GO_SDK_VERSION) })}{" "}
				{t("appBuilder.expoGo.getApp")}{" "}
				{EXPO_GO_STORE_LINKS.map((store, index) => (
					<span key={store.url}>
						{index > 0 ? " · " : null}
						<a
							href={store.url}
							target="_blank"
							rel="noopener noreferrer"
							className="whitespace-nowrap font-medium text-night underline decoration-night/25 underline-offset-2 transition-colors hover:decoration-ember dark:text-foreground dark:decoration-white/25"
						>
							{store.label}
						</a>
					</span>
				))}
			</p>
			<details className="group">
				<summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-full font-grotesk font-medium text-[13px] text-night/70 outline-none transition-colors hover:text-night focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-foreground/70 dark:hover:text-foreground [&::-webkit-details-marker]:hidden">
					{t("appBuilder.expoGo.trouble")}
					<CaretDownIcon
						aria-hidden
						weight="bold"
						className="size-3.5 transition-transform group-open:rotate-180 motion-reduce:transition-none"
					/>
				</summary>
				<ul className="mt-2.5 flex list-disc flex-col gap-1.5 ps-4 font-sans text-[12.5px] text-night/60 leading-snug marker:text-ember dark:text-foreground/60">
					<li>{t("appBuilder.expoGo.oauthNote")}</li>
					<li>{t("appBuilder.expoGo.mismatchHelp")}</li>
					<li>{t("appBuilder.expoGo.fallback")}</li>
				</ul>
			</details>
		</div>
	);
}

// The QR block is 216 px wide in the 264 px column and in the popover, so the notes below stay in view.
const QR_BLOCK_WIDTH_CLASS = "w-[216px] max-w-full";

// A white tile: phone cameras read a dark code on a light ground, in dark mode too.
// A 1 px shadow only: a large drop shadow reads as a second frame around the QR.
const QR_TILE_CLASS =
	"aspect-square w-full rounded-[20px] bg-white p-3 shadow-[0_1px_2px_rgb(11_16_51/0.08)] ring-1 ring-night/[0.08] dark:ring-white/10";

// The waiting and failed states keep the place and the shape of the QR tile, so nothing jumps.
const QR_PLACE_CLASS = cn(
	QR_BLOCK_WIDTH_CLASS,
	"flex aspect-square flex-col items-center justify-center gap-3 rounded-[20px] border border-night/[0.1] border-dashed bg-night/[0.02] p-5 text-center dark:border-white/[0.12] dark:bg-white/[0.02]",
);

/** QR side in the SVG, CSS px: the 216 px tile minus its 12 px padding on each side. */
const QR_SIZE_PX = 192;

/** The QR with its URL and copy button, or the asleep, pending, failed, or expired state. */
function LinkArea({
	link,
	onRefresh,
}: Pick<ExpoGoLinkBodyProps, "link" | "onRefresh">) {
	const { t } = useTranslation();

	if (link.status === "asleep") {
		return (
			<div className={QR_PLACE_CLASS}>
				<span className="grid size-12 place-items-center rounded-full bg-night/[0.05] dark:bg-white/[0.06]">
					<MoonStarsIcon
						aria-hidden
						weight="duotone"
						className="size-6 text-night/55 dark:text-foreground/60"
					/>
				</span>
				<p className="text-pretty font-sans text-[13.5px] text-night/60 leading-snug dark:text-foreground/60">
					{t("appBuilder.expoGo.asleep")}
				</p>
			</div>
		);
	}
	if (link.status === "pending") {
		return (
			<Skeleton
				className={cn(QR_BLOCK_WIDTH_CLASS, "aspect-square rounded-[20px]")}
			/>
		);
	}
	if (
		link.status === "previewFailed" ||
		link.status === "error" ||
		link.isExpired
	) {
		let message = t("appBuilder.expoGo.expired");
		if (link.status === "previewFailed") {
			message = t("appBuilder.expoGo.previewFailed");
		} else if (link.status === "error") {
			message = link.message;
		}
		return (
			<div role="alert" className={QR_PLACE_CLASS}>
				<p className="text-pretty font-sans text-[13.5px] text-night/65 leading-snug dark:text-foreground/65">
					{message}
				</p>
				<Button
					variant="outline"
					size="sm"
					onClick={onRefresh}
					className="rounded-full border-night/15 bg-white font-grotesk font-medium text-night hover:bg-night/[0.04] hover:text-night dark:border-white/15 dark:bg-transparent dark:text-foreground dark:hover:bg-white/[0.06]"
				>
					<ArrowClockwiseIcon aria-hidden weight="bold" />
					{link.status === "ready"
						? t("appBuilder.expoGo.newLink")
						: t("appBuilder.expoGo.retry")}
				</Button>
			</div>
		);
	}
	const { expoUrl } = link;
	return (
		<div className={cn(QR_BLOCK_WIDTH_CLASS, "flex flex-col gap-2")}>
			<div className={QR_TILE_CLASS}>
				<QRCodeSVG
					value={expoUrl}
					size={QR_SIZE_PX}
					title={t("appBuilder.expoGo.qrLabel")}
					className="size-full"
				/>
			</div>
			<div className="flex h-9 items-center gap-1 rounded-full bg-night/[0.045] ps-3.5 pe-1 dark:bg-white/[0.06]">
				{/* A URL reads left to right in every locale. */}
				<code
					dir="ltr"
					className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-night/70 dark:text-foreground/70"
				>
					{expoUrl}
				</code>
				<IconAction label={t("appBuilder.expoGo.copy")}>
					<Button
						variant="ghost"
						size="icon-sm"
						className={cn(TOOLBAR_ICON_BUTTON_CLASS, "size-7")}
						onClick={() => {
							void copyToClipboard(expoUrl).then((copied) => {
								if (copied) toast(t("appBuilder.expoGo.copied"));
							});
						}}
					>
						<CopyIcon aria-hidden weight="bold" className="size-4" />
					</Button>
				</IconAction>
			</div>
		</div>
	);
}

// A quiet text link: the QR is the main action of the column, not the username.
const USERNAME_LINK_CLASS =
	"rounded-sm font-grotesk font-medium text-[13px] text-night/70 underline decoration-night/25 underline-offset-2 outline-none transition-colors hover:text-night hover:decoration-ember focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-foreground/70 dark:decoration-white/25 dark:hover:text-foreground";

/**
 * One quiet line: the saved account with "Change", or an "Add" link while
 * no name is saved. Android needs no name, so the field opens only on a click.
 */
function UsernameRow({
	expoUsername,
	onSave,
}: {
	/** The saved Expo Go account, or "". */
	expoUsername: string;
	/** Saves the typed name, "" included. */
	onSave: (expoUsername: string) => void;
}) {
	const { t } = useTranslation();
	const inputId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(expoUsername);
	// The API rejects any other name with a 400, so the field checks the same schema.
	const isValid = draft === "" || expoUsernameSchema.safeParse(draft).success;

	// The click that opens the field unmounts its button, so the focus moves to the field.
	useEffect(() => {
		if (isEditing) inputRef.current?.focus();
	}, [isEditing]);

	if (!isEditing) {
		return expoUsername === "" ? (
			<button
				type="button"
				className={cn(USERNAME_LINK_CLASS, "w-fit text-start")}
				onClick={() => setIsEditing(true)}
			>
				{t("appBuilder.expoGo.usernameAdd")}
			</button>
		) : (
			<p className="font-grotesk font-medium text-[13px] text-night/60 dark:text-foreground/60">
				<span className="break-all">
					{t("appBuilder.expoGo.usernameCurrent", { name: expoUsername })}
				</span>
				{" · "}
				<button
					type="button"
					aria-label={t("appBuilder.expoGo.usernameChange")}
					className={USERNAME_LINK_CLASS}
					onClick={() => setIsEditing(true)}
				>
					{t("appBuilder.expoGo.usernameEdit")}
				</button>
			</p>
		);
	}
	return (
		<form
			className="flex flex-col gap-1.5"
			onSubmit={(event) => {
				event.preventDefault();
				if (!isValid) return;
				onSave(draft);
				setIsEditing(false);
			}}
		>
			<Label
				htmlFor={inputId}
				className="font-grotesk font-medium text-[12.5px] text-night/70 dark:text-foreground/70"
			>
				{t("appBuilder.expoGo.usernameLabel")}
			</Label>
			<div className="flex gap-1.5">
				<Input
					ref={inputRef}
					id={inputId}
					dir="ltr"
					value={draft}
					onChange={(event) => setDraft(event.target.value.trim())}
					autoComplete="off"
					autoCapitalize="none"
					spellCheck={false}
					aria-invalid={!isValid}
					className="h-9 rounded-full border-night/[0.12] bg-white px-3.5 font-mono text-[13px] shadow-none dark:border-white/[0.12] dark:bg-white/[0.04]"
				/>
				{/* A quiet pill: the QR is the main action of the column, not the username. */}
				<Button
					type="submit"
					variant="outline"
					disabled={!isValid}
					className="h-9 rounded-full border-night/15 bg-white px-4 font-grotesk font-semibold text-night hover:bg-night/[0.04] hover:text-night dark:border-white/15 dark:bg-transparent dark:text-foreground dark:hover:bg-white/[0.06]"
				>
					{t("appBuilder.expoGo.usernameSave")}
				</Button>
			</div>
			<span
				className={cn(
					"font-sans text-[12px] leading-snug",
					isValid
						? "text-night/50 dark:text-foreground/50"
						: "text-destructive",
				)}
			>
				{isValid
					? t("appBuilder.expoGo.usernameHint")
					: t("appBuilder.expoGo.usernameInvalid")}
			</span>
		</form>
	);
}
