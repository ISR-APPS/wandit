/**
 * The floating sidebar of the dashboard pages: a paper card beside the
 * content, in the look of the landing page. DashboardShell renders it. It
 * holds the logo, the workspace switcher, the page links, the feedback
 * entry, the language segments, and the user menu. The active link is a
 * night pill with a spark circle, like the platform token of the landing hero.
 */
import { Link, useLocation } from "@tanstack/react-router";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@wandit/ui/components/sidebar";
import { cn } from "@wandit/ui/lib/utils";
import type * as React from "react";

import { Spark } from "@/components/logo";
import { useAffiliatePortalMeQuery } from "@/features/affiliates/api/affiliates.queries";
import { UserMenu } from "@/features/auth";
import { UpgradeCard } from "@/features/billing/components/upgrade-button";
import { FeedbackHost } from "@/features/feedback";
import { isChatwootConfigured, openSupportChat } from "@/features/support";
import { WorkspaceSwitcher } from "@/features/workspaces/components/workspace-switcher";
import { localeMeta, locales, useI18n, useTranslation } from "@/lib/i18n";
import {
	AFFILIATE_NAV_GROUP,
	NAV_GROUPS,
	type NavGroup,
	type NavItem,
} from "../../lib/nav-config";

// One look for every link: a pill with the icon in a circle. Collapsed, the
// pill is a 40 px circle. In dark mode the active pill is spark, because
// night does not show on the dark card.
const NAV_BUTTON_CLASS = cn(
	"group/nav h-10 gap-2.5 rounded-full ps-1.5 pe-3 font-grotesk font-medium text-night/75 transition-colors",
	"hover:bg-night/[0.06] hover:text-night active:bg-night/10 active:text-night",
	"data-[active=true]:bg-night data-[active=true]:text-paper data-[active=true]:hover:bg-night data-[active=true]:hover:text-paper",
	"group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:p-1.5!",
	"dark:text-foreground/75 dark:active:bg-white/10 dark:hover:bg-white/[0.06] dark:hover:text-foreground",
	"dark:data-[active=true]:bg-spark dark:data-[active=true]:text-night dark:data-[active=true]:hover:bg-spark dark:data-[active=true]:hover:text-night",
);

/** The icon in its circle. On the active link the circle is spark (night in dark mode) and the icon is filled. */
function NavIcon({
	icon: Icon,
	isActive,
}: {
	icon: NavItem["icon"];
	isActive: boolean;
}) {
	return (
		<span className="grid size-7 shrink-0 place-items-center rounded-full transition-colors group-data-[active=true]/nav:bg-spark group-data-[active=true]/nav:text-night dark:group-data-[active=true]/nav:bg-night dark:group-data-[active=true]/nav:text-spark">
			<Icon
				aria-hidden
				weight={isActive ? "fill" : "duotone"}
				className="size-[18px]"
			/>
		</span>
	);
}

function NavEntry({ item }: { item: NavItem }) {
	const pathname = useLocation({ select: (location) => location.pathname });
	const { t } = useTranslation();
	const { isMobile, setOpenMobile } = useSidebar();
	const title = t(item.titleKey);

	if (item.type === "route") {
		const isActive = pathname === item.to || pathname.startsWith(`${item.to}/`);
		return (
			<SidebarMenuButton
				asChild
				isActive={isActive}
				tooltip={title}
				className={NAV_BUTTON_CLASS}
			>
				<Link to={item.to}>
					<NavIcon icon={item.icon} isActive={isActive} />
					<span>{title}</span>
				</Link>
			</SidebarMenuButton>
		);
	}

	if (item.type === "external") {
		return (
			<SidebarMenuButton asChild tooltip={title} className={NAV_BUTTON_CLASS}>
				<a href={item.href}>
					<NavIcon icon={item.icon} isActive={false} />
					<span>{title}</span>
				</a>
			</SidebarMenuButton>
		);
	}

	if (item.type === "action" && item.action === "send-feedback") {
		// Do not close the mobile sheet here. The host lives inside the sheet,
		// so a closed sheet unmounts the host and its dialog.
		return (
			<FeedbackHost
				renderTrigger={(open) => (
					<SidebarMenuButton
						onClick={open}
						tooltip={title}
						className={NAV_BUTTON_CLASS}
					>
						<NavIcon icon={item.icon} isActive={false} />
						<span>{title}</span>
					</SidebarMenuButton>
				)}
			/>
		);
	}

	if (item.type === "action") {
		// The support chat is disabled when the widget is not configured, so
		// the button never silently does nothing.
		return (
			<SidebarMenuButton
				disabled={!isChatwootConfigured}
				onClick={() => {
					// The mobile sidebar is a modal sheet: while open it sets
					// body pointer-events:none, which the chat window inherits.
					if (isMobile) setOpenMobile(false);
					openSupportChat();
				}}
				tooltip={title}
				className={NAV_BUTTON_CLASS}
			>
				<NavIcon icon={item.icon} isActive={false} />
				<span>{title}</span>
			</SidebarMenuButton>
		);
	}

	return (
		<>
			<SidebarMenuButton disabled tooltip={title} className={NAV_BUTTON_CLASS}>
				<NavIcon icon={item.icon} isActive={false} />
				<span>{title}</span>
			</SidebarMenuButton>
			{/* The 20 px badge is centered on the 40 px pill. */}
			<SidebarMenuBadge className="end-2 rounded-full bg-night/[0.06] px-2 font-grotesk font-medium text-[11px] text-night/55 peer-data-[size=default]/menu-button:top-2.5 dark:bg-white/[0.08] dark:text-foreground/60">
				{t("projects.sidebar.soon")}
			</SidebarMenuBadge>
		</>
	);
}

/**
 * One segment per locale, each in its own language. The active one is a
 * night pill, like the language switch of the landing page. Hidden when
 * the sidebar is collapsed; the user menu also lists the languages.
 */
function LanguageSegments() {
	const { locale, setLocale, t } = useI18n();

	return (
		<fieldset
			aria-label={t("common.language")}
			className="grid grid-cols-3 gap-0.5 rounded-full bg-night/[0.05] p-1 group-data-[collapsible=icon]:hidden dark:bg-white/[0.06]"
		>
			{locales.map((code) => {
				const isActive = code === locale;
				return (
					<button
						key={code}
						type="button"
						// The lang attribute picks the right face: Readex Pro for Arabic, Bricolage for the others.
						lang={code}
						aria-pressed={isActive}
						onClick={() => setLocale(code)}
						className={cn(
							"h-8 truncate rounded-full px-1 font-grotesk font-semibold text-xs outline-offset-2 transition-colors focus-visible:outline-2 focus-visible:outline-ember",
							isActive
								? "bg-night text-paper dark:bg-spark dark:text-night"
								: "text-night/60 hover:text-night dark:text-foreground/60 dark:hover:text-foreground",
						)}
					>
						{localeMeta[code].nativeLabel}
					</button>
				);
			})}
		</fieldset>
	);
}

function NavGroupList({ group }: { group: NavGroup }) {
	const { t } = useTranslation();
	return (
		<SidebarGroup>
			<SidebarGroupLabel className="px-3 font-grotesk text-night/45 dark:text-foreground/45">
				{t(group.titleKey)}
			</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu className="gap-0.5">
					{group.items.map((item) => (
						<SidebarMenuItem key={item.titleKey}>
							<NavEntry item={item} />
						</SidebarMenuItem>
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}

/** Collapses to icons with Ctrl+B (Cmd+B on a Mac) or the bar button. On a phone it is a sheet. */
export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
	const { t } = useTranslation();
	const affiliateQuery = useAffiliatePortalMeQuery();
	const showAffiliateNavigation =
		!affiliateQuery.isPending &&
		!affiliateQuery.isError &&
		Boolean(affiliateQuery.data?.affiliate);
	return (
		<Sidebar
			collapsible="icon"
			mobileTitle={t("projects.sidebar.mobileTitle")}
			mobileDescription={t("projects.sidebar.mobileDescription")}
			{...props}
			// The card is the floating variant of the shared sidebar. These classes
			// give it the paper face, the night hairline, and the large radius.
			className={cn(
				"[--sidebar-border:rgb(11_16_51/0.1)] [--sidebar:var(--color-paper)] dark:[--sidebar-border:var(--border)] dark:[--sidebar:var(--card)]",
				"[&>[data-slot=sidebar-inner]]:rounded-[1.5rem] [&>[data-slot=sidebar-inner]]:shadow-[0_1px_0_rgb(11_16_51/0.04),0_16px_40px_-24px_rgb(11_16_51/0.3)]",
				props.className,
			)}
		>
			<SidebarHeader className="gap-3 p-2">
				<Link
					to="/dashboard"
					aria-label={t("projects.logoLabel")}
					className="group/logo flex h-10 items-center gap-2 rounded-xl px-1 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ember group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
				>
					{/* The mark sits on an app-icon tile, like the landing nav: Wandit makes apps. */}
					<span
						aria-hidden
						className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-night dark:ring-1 dark:ring-white/10"
					>
						<Spark className="size-4.5 text-spark transition-transform duration-500 ease-out group-hover/logo:rotate-90 motion-reduce:transition-none" />
					</span>
					{/* The wordmark keeps the Latin brand face in every locale. */}
					<span
						lang="en"
						className="font-extrabold font-grotesk text-[1.375rem] text-night leading-none tracking-[-0.045em] group-data-[collapsible=icon]:hidden dark:text-foreground"
					>
						wandit
					</span>
				</Link>
				<WorkspaceSwitcher className="h-11 rounded-2xl border-night/10 bg-transparent px-2 font-grotesk hover:bg-night/[0.04] group-data-[collapsible=icon]:hidden dark:border-border dark:hover:bg-white/[0.06] [&_[data-slot=avatar-fallback]]:bg-spark [&_[data-slot=avatar-fallback]]:font-semibold [&_[data-slot=avatar-fallback]]:text-night [&_[data-slot=avatar]]:size-7" />
			</SidebarHeader>
			<SidebarContent className="gap-0">
				{NAV_GROUPS.map((group) => (
					<NavGroupList key={group.titleKey} group={group} />
				))}
				{showAffiliateNavigation ? (
					<NavGroupList group={AFFILIATE_NAV_GROUP} />
				) : null}
			</SidebarContent>
			<SidebarFooter className="gap-2 p-2 pb-3">
				{/* The upgrade card gates itself on purchases + free plan, so this
				    stays invisible until billing opens (ship-dark launch policy). */}
				<UpgradeCard className="group-data-[collapsible=icon]:hidden" />
				<LanguageSegments />
				<UserMenu variant="sidebar" />
			</SidebarFooter>
			<SidebarRail
				aria-label={t("projects.sidebar.toggleSidebar")}
				title={t("projects.sidebar.toggleSidebar")}
			/>
		</Sidebar>
	);
}
