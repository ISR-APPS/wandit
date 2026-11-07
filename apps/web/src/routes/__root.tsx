/**
 * The root route of the web app: the page head, and the providers around every page.
 * TanStack Router builds the route tree from this file. It wraps every route in
 * React Query, i18n, theme, auth modal, workspace, and billing modal providers.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { DirectionProvider } from "@wandit/ui/components/direction";
import { Toaster } from "@wandit/ui/components/sonner";

import { ThemeProvider } from "@/components/theme-provider";
import { AffiliateCapture } from "@/features/affiliates/lib/use-affiliate-capture";
import { useGithubReturnToast } from "@/features/app-builder";
import { AuthModalProvider } from "@/features/auth";
import { BillingModalProvider } from "@/features/billing/components/billing-modal-provider";
import { useConnectReturnToast } from "@/features/connectors/components/connect-return-toast";
import { UtmCapture } from "@/features/story-links/lib/use-utm-capture";
import { isChatwootConfigured } from "@/features/support";
import { WorkspaceProvider } from "@/features/workspaces/lib/workspace-provider";
import { AppI18nProvider, pageTitle, useI18n } from "@/lib/i18n";
import { queryClient } from "@/lib/query-client";

import "../index.css";

// Grows when the backend lands: session, preloaded queries…
export type RouterAppContext = Record<string, never>;

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
	head: () => ({
		meta: [
			{
				title: pageTitle("common.appTitle"),
			},
			{
				name: "description",
				content: pageTitle("common.appDescription"),
			},
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.svg",
				type: "image/svg+xml",
			},
		],
	}),
});

function RootComponent() {
	return (
		<>
			<HeadContent />
			<QueryClientProvider client={queryClient}>
				<AppI18nProvider>
					<RootProviders />
				</AppI18nProvider>
			</QueryClientProvider>
			{/* Dev builds only. On the left it covers the cost line under the V2 chat composer. */}
			<TanStackRouterDevtools position="bottom-right" />
		</>
	);
}

function RootProviders() {
	const { dir } = useI18n();
	useConnectReturnToast();
	useGithubReturnToast();

	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="light"
			disableTransitionOnChange
			storageKey="wandit-theme"
		>
			<DirectionProvider dir={dir}>
				<AuthModalProvider>
					<WorkspaceProvider>
						<BillingModalProvider>
							<AffiliateCapture />
							<UtmCapture />
							<Outlet />
						</BillingModalProvider>
					</WorkspaceProvider>
				</AuthModalProvider>
				{/* The live-chat launcher is fixed 64px + 20px from the bottom
				    corner; lift toasts above it (Sonner does not mirror in RTL,
				    so a bottom offset covers both directions). */}
				<Toaster
					richColors
					dir={dir}
					offset={isChatwootConfigured ? { bottom: 96 } : undefined}
					mobileOffset={isChatwootConfigured ? { bottom: 96 } : undefined}
				/>
			</DirectionProvider>
		</ThemeProvider>
	);
}
