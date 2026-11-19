/**
 * The web sources of one reply: the pages that its `web_search` calls found.
 * chat-message.tsx renders `SourcesButton` in the reply footer (stacked site
 * icons and "{count} sources", which opens the list) and gives Streamdown
 * `SOURCE_LINK_COMPONENTS`: a link to a source site shows as a chip, and
 * every link of the answer asks a confirm before it opens a new tab.
 * The sources come from the `data-sources` part of lib/turn-parts.ts.
 */

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@wandit/ui/components/alert-dialog";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@wandit/ui/components/popover";
import { cn } from "@wandit/ui/lib/utils";
import {
	type ComponentProps,
	createContext,
	type ReactNode,
	useContext,
	useState,
} from "react";
import type { Components, ExtraProps } from "streamdown";

import { formatNumber, useTranslation } from "@/lib/i18n";
import type { BuilderSource } from "../../api/dto";
import { webHostOf } from "../../lib/turn-parts";

/** The footer shows this many icons in its stack; the count names all sources. */
const STACKED_ICON_COUNT = 3;

/** The href Streamdown gives a link whose markdown is not complete yet, while the answer streams. */
const INCOMPLETE_LINK_HREF = "streamdown:incomplete-link";

/**
 * The sources of the reply that renders now. chat-message.tsx provides it
 * around each answer text, so the stable `a` override below can read it.
 */
export const MessageSourcesContext = createContext<BuilderSource[]>([]);

/**
 * The site icon of one source, or a tinted letter tile when the source has
 * no icon or the icon fails to load. The size comes from `className`.
 */
function SourceIcon({
	source,
	className,
}: {
	source: BuilderSource;
	/** Size and ring classes, for example "size-4". */
	className?: string;
}) {
	const [hasFailed, setHasFailed] = useState(false);
	if (source.favicon === null || hasFailed) {
		return (
			<span
				aria-hidden
				className={cn(
					"grid shrink-0 place-items-center rounded-full bg-ember/[0.14] font-grotesk font-semibold text-[9px] text-ember-text uppercase leading-none dark:bg-spark/[0.16] dark:text-spark",
					className,
				)}
			>
				{source.hostname.charAt(0)}
			</span>
		);
	}
	return (
		// Decorative: the hostname or the title next to it names the source.
		// No referrer, so the icon host does not learn which project the user reads.
		<img
			src={source.favicon}
			alt=""
			loading="lazy"
			decoding="async"
			referrerPolicy="no-referrer"
			onError={() => setHasFailed(true)}
			className={cn(
				"shrink-0 rounded-full bg-white object-cover dark:bg-white/[0.9]",
				className,
			)}
		/>
	);
}

/**
 * The footer button of a reply with sources: up to 3 stacked icons and
 * "{count} sources". It opens a list with one link row per source.
 */
export function SourcesButton({
	sources,
}: {
	/** The `data-sources` payload of the reply, at least one source. */
	sources: BuilderSource[];
}) {
	const { t, locale } = useTranslation();
	const label = t("appBuilder.chat.sources", {
		count: sources.length,
		countDisplay: formatNumber(sources.length, locale),
	});
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="flex h-7 items-center gap-1.5 rounded-full ps-1 pe-2 font-grotesk text-[12px] text-night/55 tabular-nums outline-none transition-colors hover:bg-night/[0.05] hover:text-night focus-visible:ring-2 focus-visible:ring-ember/30 dark:text-foreground/55 dark:hover:bg-white/[0.06] dark:hover:text-foreground"
				>
					<span aria-hidden className="flex">
						{sources.slice(0, STACKED_ICON_COUNT).map((source, index) => (
							// The ring in the desk color cuts each icon from the one under it.
							<SourceIcon
								key={source.url}
								source={source}
								className={cn(
									"size-4 ring-2 ring-background",
									index > 0 && "-ms-1.5",
								)}
							/>
						))}
					</span>
					{label}
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="flex max-h-80 w-80 max-w-[calc(100vw-24px)] flex-col overflow-y-auto p-1.5"
			>
				<p className="px-2 pt-1 pb-1.5 font-grotesk font-medium text-popover-foreground/60 text-xs">
					{label}
				</p>
				<ul className="flex flex-col">
					{sources.map((source) => (
						<li key={source.url}>
							<SourceRow source={source} />
						</li>
					))}
				</ul>
			</PopoverContent>
		</Popover>
	);
}

/** One row of the sources list: the icon, the title, and the hostname. A link only for an http: or https: page. */
function SourceRow({ source }: { source: BuilderSource }) {
	const content = (
		<>
			<SourceIcon source={source} className="mt-0.5 size-4" />
			<span className="flex min-w-0 flex-col">
				<span
					dir="auto"
					className="truncate text-[13px] text-popover-foreground"
				>
					{source.title}
				</span>
				<span className="truncate font-mono text-[11.5px] text-popover-foreground/50">
					{source.hostname}
				</span>
			</span>
		</>
	);
	const rowClass = "flex items-start gap-2.5 rounded-[12px] px-2 py-1.5";
	if (source.href === null) return <div className={rowClass}>{content}</div>;
	return (
		<a
			href={source.href}
			target="_blank"
			rel="noopener noreferrer"
			className={cn(
				rowClass,
				"outline-none transition-colors hover:bg-popover-foreground/[0.05] focus-visible:ring-2 focus-visible:ring-ember/30",
			)}
		>
			{content}
		</a>
	);
}

/**
 * A link of the answer. A link to a page or a site of a source gets the site
 * icon. A citation link (its text is the URL or the host) shows only the host.
 * Every link asks the open-link confirm first, as the Streamdown link does.
 */
function SourceAwareLink({
	href,
	children,
	className,
}: ComponentProps<"a"> & ExtraProps) {
	const sources = useContext(MessageSourcesContext);
	// An incomplete link has no address yet while the answer streams; it opens nothing.
	const openHref =
		href === undefined || href === "" || href === INCOMPLETE_LINK_HREF
			? null
			: href;
	const linkHost = openHref === null ? null : webHostOf(openHref);
	const exactSource = sources.find((candidate) => candidate.url === openHref);
	const source =
		linkHost === null
			? undefined
			: (exactSource ??
				sources.find((candidate) => candidate.hostname === linkHost));
	if (source === undefined) {
		// The classes of the Streamdown 2.5 link button. Streamdown does not
		// export its link, so this copy must follow it on an upgrade.
		return (
			<ConfirmLinkButton
				href={openHref}
				isIncomplete={href === INCOMPLETE_LINK_HREF}
				className={cn(
					"wrap-anywhere appearance-none text-start font-medium text-primary underline",
					className,
				)}
			>
				{children}
			</ConfirmLinkButton>
		);
	}
	// A link with no markup inside has a plain string as its children.
	const linkText = typeof children === "string" ? children.trim() : null;
	const isCitation =
		linkText !== null &&
		(linkText === openHref ||
			linkText.replace(/^www\./, "") === source.hostname);
	return (
		<ConfirmLinkButton
			href={openHref}
			isIncomplete={false}
			// Only the exact page has a known title; another page of the site has none here.
			title={exactSource?.title}
			className="mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md bg-night/[0.05] py-px ps-1 pe-1.5 align-[0.08em] font-mono text-[11.5px] text-night/70 leading-[1.5] no-underline outline-none transition-colors hover:bg-night/[0.09] hover:text-night focus-visible:ring-2 focus-visible:ring-ember/30 dark:bg-white/[0.07] dark:text-foreground/70 dark:hover:bg-white/[0.12] dark:hover:text-foreground"
		>
			<SourceIcon source={source} className="size-3.5" />
			<span className="truncate">
				{isCitation ? source.hostname : children}
			</span>
		</ConfirmLinkButton>
	);
}

/**
 * A link button of the answer that opens its page only after a confirm.
 * Security: a web page can make the agent write a phishing link, so the
 * dialog shows the full address before the new tab opens.
 */
function ConfirmLinkButton({
	href,
	isIncomplete,
	title,
	className,
	children,
}: {
	/** The link address from the answer markdown; null when it opens nothing. */
	href: string | null;
	/** True while Streamdown streams the markdown of this link. */
	isIncomplete: boolean;
	/** Hover text, for example the title of the source page. */
	title?: string;
	className: string;
	children: ReactNode;
}) {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useState(false);
	return (
		<>
			<button
				type="button"
				title={title}
				data-incomplete={isIncomplete}
				data-streamdown="link"
				onClick={() => {
					if (href !== null) setIsOpen(true);
				}}
				className={className}
			>
				{children}
			</button>
			{href === null ? null : (
				<AlertDialog open={isOpen} onOpenChange={setIsOpen}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>
								{t("appBuilder.chat.openLink.title")}
							</AlertDialogTitle>
							<AlertDialogDescription>
								{t("appBuilder.chat.openLink.body")}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<p
							dir="ltr"
							className="break-all rounded-md bg-muted px-3 py-2 font-mono text-xs"
						>
							{href}
						</p>
						<AlertDialogFooter>
							<AlertDialogCancel>
								{t("appBuilder.chat.openLink.cancel")}
							</AlertDialogCancel>
							<AlertDialogAction
								onClick={() =>
									window.open(href, "_blank", "noopener,noreferrer")
								}
							>
								{t("appBuilder.chat.openLink.confirm")}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			)}
		</>
	);
}

/**
 * The Streamdown override for a reply with sources. A module constant, so
 * Streamdown keeps its rendered blocks between stream chunks.
 */
export const SOURCE_LINK_COMPONENTS: Components = { a: SourceAwareLink };
