/**
 * "Open on phone" button of the top bar and its popover, for mobile
 * projects (WANDIT-193). Each open mints a new phone link and shows its
 * Expo Go QR, the store links, and the iPhone username field.
 * Rendered by components/shell/top-bar.tsx. Mints through
 * useMintPhonePreviewLink; ExpoGoLinkBody is pure, and the spec renders it.
 */

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
import { Copy, QrCode, RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useId, useState } from "react";
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

export type ExpoGoPopoverProps = {
	/** The open mobile project. Its id mints the phone link. */
	projectId: string;
};

/** The trigger sits next to the device switch; the content mounts on each open. */
export function ExpoGoPopover({ projectId }: ExpoGoPopoverProps) {
	const { t } = useTranslation();

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant="outline" size="sm" className="hidden md:inline-flex">
					<QrCode className="size-3.5" />
					{t("appBuilder.expoGo.cta")}
				</Button>
			</PopoverTrigger>
			{/* 340 px holds the QR and the username row. On a phone it keeps 12 px from each edge. */}
			<PopoverContent
				align="end"
				className="flex w-[340px] max-w-[calc(100vw-24px)] flex-col gap-3 p-4"
			>
				{/* Radix mounts the content on each open, so each open mints a new link. */}
				<ExpoGoPanel projectId={projectId} />
			</PopoverContent>
		</Popover>
	);
}

/** Holds the username and the mint. A username change mints a new link with the new claim. */
function ExpoGoPanel({ projectId }: ExpoGoPopoverProps) {
	const { t } = useTranslation();
	const [expoUsername, setExpoUsername] = useState(readExpoUsername);
	// A new mutate resets `data` and `error`, so a pending mint reads as neither.
	const { mutate, data: link, error } = useMintPhonePreviewLink(projectId);
	// The expoUrl whose expiry passed. A new link has another URL, so this needs no reset.
	const [expiredUrl, setExpiredUrl] = useState<string | null>(null);

	useEffect(() => {
		mutate(expoUsername);
	}, [mutate, expoUsername]);

	useEffect(() => {
		if (link === undefined) return;
		const timerId = setTimeout(
			() => setExpiredUrl(link.expoUrl),
			Math.max(Date.parse(link.expiresAt) - Date.now(), 0),
		);
		return () => clearTimeout(timerId);
	}, [link]);

	let state: ExpoGoLinkState = { status: "pending" };
	if (error !== null) {
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
			onRefresh={() => mutate(expoUsername)}
		/>
	);
}

/** Mint state of the phone link as the body shows it. `pending` also covers the idle render before the first mint. */
export type ExpoGoLinkState =
	| { status: "pending" }
	| { status: "ready"; expoUrl: string; isExpired: boolean }
	| { status: "error"; message: string };

export type ExpoGoLinkBodyProps = {
	/** The mint state from ExpoGoPanel. `ready` carries the `exps://` URL of the phone link. */
	link: ExpoGoLinkState;
	/** Expo Go account for the iPhone, from localStorage. "" when the user typed none. */
	expoUsername: string;
	/** Stores a new username, "" included. The panel then mints a new link with it. */
	onSaveUsername: (expoUsername: string) => void;
	/** Mints a new link. The retry and the new-link buttons call it. */
	onRefresh: () => void;
};

/** The QR area, the username row, and the notes of the Expo Go popover. */
export function ExpoGoLinkBody({
	link,
	expoUsername,
	onSaveUsername,
	onRefresh,
}: ExpoGoLinkBodyProps) {
	const { t } = useTranslation();

	return (
		<>
			<div className="flex flex-col gap-1">
				<span className="font-semibold text-sm">
					{t("appBuilder.expoGo.title")}
				</span>
				<span className="text-muted-foreground text-xs">
					{t("appBuilder.expoGo.scanHint")}
				</span>
			</div>
			<LinkArea link={link} onRefresh={onRefresh} />
			<UsernameRow expoUsername={expoUsername} onSave={onSaveUsername} />
			<ul className="flex flex-col gap-1.5 text-muted-foreground text-xs">
				<li>
					{t("appBuilder.expoGo.sdk", { sdk: String(EXPO_GO_SDK_VERSION) })}{" "}
					{t("appBuilder.expoGo.getApp")}{" "}
					{EXPO_GO_STORE_LINKS.map((store, index) => (
						<span key={store.url}>
							{index > 0 ? " · " : null}
							<a
								href={store.url}
								target="_blank"
								rel="noopener noreferrer"
								className="text-foreground underline underline-offset-2"
							>
								{store.label}
							</a>
						</span>
					))}
				</li>
				<li>{t("appBuilder.expoGo.oauthNote")}</li>
				<li>{t("appBuilder.expoGo.mismatchHelp")}</li>
				<li>{t("appBuilder.expoGo.fallback")}</li>
			</ul>
		</>
	);
}

/** QR size, CSS px. Large enough for a phone camera at arm's length, small enough for the 340 px popover. */
const QR_SIZE_PX = 168;

/** The QR with its URL and copy button, or the pending, error, or expired state. */
function LinkArea({
	link,
	onRefresh,
}: Pick<ExpoGoLinkBodyProps, "link" | "onRefresh">) {
	const { t } = useTranslation();

	if (link.status === "pending") {
		return <Skeleton className="mx-auto size-[184px] rounded-lg" />;
	}
	if (link.status === "error" || link.isExpired) {
		return (
			<div
				role="alert"
				className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center"
			>
				<p className="text-muted-foreground text-sm">
					{link.status === "error"
						? link.message
						: t("appBuilder.expoGo.expired")}
				</p>
				<Button variant="outline" size="sm" onClick={onRefresh}>
					<RefreshCw className="size-3.5" />
					{link.status === "error"
						? t("appBuilder.expoGo.retry")
						: t("appBuilder.expoGo.newLink")}
				</Button>
			</div>
		);
	}
	const { expoUrl } = link;
	return (
		<div className="flex flex-col items-center gap-2">
			{/* A white quiet zone: phone cameras read a dark code on a light ground, in dark mode too. */}
			<div className="rounded-lg bg-white p-2">
				<QRCodeSVG
					value={expoUrl}
					size={QR_SIZE_PX}
					title={t("appBuilder.expoGo.qrLabel")}
				/>
			</div>
			<div className="flex w-full items-center gap-2">
				{/* A URL reads left to right in every locale. */}
				<code
					dir="ltr"
					className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-[11px]"
				>
					{expoUrl}
				</code>
				<Button
					variant="outline"
					size="icon-sm"
					aria-label={t("appBuilder.expoGo.copy")}
					onClick={() => {
						void copyToClipboard(expoUrl).then((copied) => {
							if (copied) toast(t("appBuilder.expoGo.copied"));
						});
					}}
				>
					<Copy className="size-3.5" />
				</Button>
			</div>
		</div>
	);
}

/**
 * The saved iPhone account with a Change button, or the field. The field
 * shows while no name is saved: an Android user can leave it empty.
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
	const [isEditing, setIsEditing] = useState(expoUsername === "");
	const [draft, setDraft] = useState(expoUsername);
	// The API rejects any other name with a 400, so the field checks the same schema.
	const isValid = draft === "" || expoUsernameSchema.safeParse(draft).success;

	if (!isEditing) {
		return (
			<div className="flex items-center justify-between gap-2 text-xs">
				<span className="min-w-0 truncate">
					{t("appBuilder.expoGo.usernameCurrent", { name: expoUsername })}
				</span>
				<Button
					variant="link"
					size="sm"
					className="h-auto shrink-0 p-0 text-xs"
					onClick={() => setIsEditing(true)}
				>
					{t("appBuilder.expoGo.usernameChange")}
				</Button>
			</div>
		);
	}
	return (
		<form
			className="flex flex-col gap-1.5"
			onSubmit={(event) => {
				event.preventDefault();
				if (!isValid) return;
				onSave(draft);
				setIsEditing(draft === "");
			}}
		>
			<Label htmlFor={inputId} className="text-xs">
				{t("appBuilder.expoGo.usernameLabel")}
			</Label>
			<div className="flex gap-2">
				<Input
					id={inputId}
					dir="ltr"
					value={draft}
					onChange={(event) => setDraft(event.target.value.trim())}
					autoComplete="off"
					autoCapitalize="none"
					spellCheck={false}
					aria-invalid={!isValid}
					className="h-8 text-sm"
				/>
				<Button type="submit" size="sm" disabled={!isValid}>
					{t("appBuilder.expoGo.usernameSave")}
				</Button>
			</div>
			<span
				className={cn(
					"text-xs",
					isValid ? "text-muted-foreground" : "text-destructive",
				)}
			>
				{isValid
					? t("appBuilder.expoGo.usernameHint")
					: t("appBuilder.expoGo.usernameInvalid")}
			</span>
		</form>
	);
}
