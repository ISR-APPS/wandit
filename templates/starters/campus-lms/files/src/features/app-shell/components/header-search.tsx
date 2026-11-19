// The page search of the header: a field-like button, and a dialog that lists the nav pages that match the text.
// AppHeader renders it. It reads NAV_GROUPS, so it lists the same pages as the sidebar, grouped the same way.
// Cmd+K on Apple devices and Ctrl+K elsewhere open the dialog. It searches pages only, never records.
import { Link, useNavigate } from "@tanstack/react-router";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Dialog, DialogContent, DialogTitle } from "~/shared/ui/dialog";
import { MagnifyingGlassIcon } from "~/shared/ui/icons";
import { Input } from "~/shared/ui/input";
import { NAV_GROUPS } from "../lib/nav-items";

// The /app area renders in the browser only (ssr: false), so navigator exists here.
function isApplePlatform(): boolean {
	return /Mac|iPhone|iPad/.test(navigator.userAgent);
}

/** The trigger at lg and up looks like a field. Below lg it is an icon button. */
export function HeaderSearch() {
	const { t, locale } = useT();
	const navigate = useNavigate();
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState("");
	const listRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// effect: listens for Cmd/Ctrl+K on the document, an external event source.
	useEffect(() => {
		function onKeyDown(event: globalThis.KeyboardEvent) {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setQuery("");
				setIsOpen((open) => !open);
			}
		}
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);

	const needle = query.trim().toLocaleLowerCase(locale);
	// Each group keeps the pages whose translated label holds the text. A child page takes the icon of its parent.
	const groups = NAV_GROUPS.map((group) => ({
		label: t(group.labelKey),
		pages: group.items
			.flatMap((item) =>
				(item.children ?? [item]).map((leaf) => ({ ...leaf, icon: item.icon })),
			)
			.filter((page) =>
				t(page.labelKey).toLocaleLowerCase(locale).includes(needle),
			),
	})).filter((group) => group.pages.length > 0);
	const firstPage = groups[0]?.pages[0];

	function openDialog() {
		setQuery("");
		setIsOpen(true);
	}

	// The arrow keys move the focus between the input and the result links. Enter on a link follows it.
	function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
			return;
		}
		const links = Array.from(
			listRef.current?.querySelectorAll<HTMLAnchorElement>("a") ?? [],
		);
		const focused = document.activeElement;
		// Focus in the input gives -1, so ArrowDown goes to the first link.
		const current =
			focused instanceof HTMLAnchorElement ? links.indexOf(focused) : -1;
		const next = event.key === "ArrowDown" ? current + 1 : current - 1;
		event.preventDefault();
		if (next < 0) {
			inputRef.current?.focus();
			return;
		}
		links[Math.min(next, links.length - 1)]?.focus();
	}

	const hint = isApplePlatform() ? "⌘ K" : "Ctrl K";

	return (
		<>
			<button
				type="button"
				onClick={openDialog}
				className="relative hidden h-9 w-full max-w-sm items-center gap-2 rounded-field border border-input bg-(--field-bg) ps-3 pe-1.5 text-muted-foreground text-sm shadow-field outline-none transition-colors hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:flex"
			>
				<MagnifyingGlassIcon className="size-4" />
				<span>{t("shell.search")}</span>
				<kbd className="ms-auto rounded-sm bg-muted px-1.5 py-0.5 font-medium font-sans text-muted-foreground text-xs">
					{hint}
				</kbd>
			</button>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="lg:hidden"
				aria-label={t("shell.search")}
				onClick={openDialog}
			>
				<MagnifyingGlassIcon />
			</Button>
			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogContent className="top-[20%] max-w-[calc(100%-2rem)] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg">
					<DialogTitle className="sr-only">{t("shell.search")}</DialogTitle>
					{/* biome-ignore lint/a11y/noStaticElementInteractions: the handler only moves the focus between the input and the links inside. */}
					<div onKeyDown={moveFocus}>
						<div className="flex items-center gap-2 border-b px-3 pe-12">
							<MagnifyingGlassIcon className="size-4 shrink-0 text-muted-foreground" />
							<Input
								ref={inputRef}
								autoFocus
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								onKeyDown={(event) => {
									// Enter in the field opens the first match, as in a command menu.
									if (event.key === "Enter" && firstPage) {
										event.preventDefault();
										setIsOpen(false);
										navigate({ to: firstPage.to });
									}
								}}
								placeholder={t("shell.searchPlaceholder")}
								aria-label={t("shell.search")}
								className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
							/>
						</div>
						<div ref={listRef} className="max-h-80 overflow-y-auto p-2">
							{groups.length === 0 ? (
								<p className="px-2 py-6 text-center text-muted-foreground text-sm">
									{t("shell.searchEmpty")}
								</p>
							) : (
								groups.map((group) => (
									<div
										key={group.label}
										className="grid gap-0.5 pb-2 last:pb-0"
									>
										<p className="px-2 py-1.5 font-medium text-muted-foreground text-xs">
											{group.label}
										</p>
										{group.pages.map((page) => (
											<Link
												key={page.to}
												to={page.to}
												onClick={() => setIsOpen(false)}
												className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
											>
												<page.icon className="size-4 text-muted-foreground" />
												{t(page.labelKey)}
											</Link>
										))}
									</div>
								))
							)}
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
