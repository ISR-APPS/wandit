import { useTranslation } from "@wandit/internationalization/react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WanditIcon, type WanditIconName } from "@/components/wandit-icon";

import { useMarketingAssetsQuery } from "../api/generation.queries";
import {
	DEFAULT_LEAD_FILTERS,
	useLeadsInfiniteQuery,
} from "../api/leads.queries";
import { useProjectAssetsQuery } from "../api/project-assets.queries";
import { AssetsView } from "../components/hub/assets-view";
import { HubToast, useHubToast } from "../components/hub/hub-toast";
import { LeadsView } from "../components/hub/leads-view";
import { MarketingView } from "../components/hub/marketing-view";
import {
	WorkspaceHubPill,
	type WorkspaceHubSection,
	type WorkspaceHubView,
} from "../components/workspace-hub-pill";

const VIEWS: readonly WorkspaceHubView[] = ["assets", "marketing", "leads"];

const SECTION_ICONS: Record<WorkspaceHubView, WanditIconName> = {
	assets: "imageTile",
	marketing: "megaphone",
	leads: "users",
};

/**
 * One screen for Assets / Marketing / Leads (prototype riff 2a "hub"): the
 * [view] route segment picks the active section and the floating hub pill
 * switches it via setParams, so there is no stack transition. All three
 * sections stay mounted (display toggle) so filters and search survive a
 * switch, like the prototype's single shared state.
 */
export function WorkspaceViewsScreen() {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const foreground = useThemeColor("foreground");
	const { projectId, view } = useLocalSearchParams<{
		projectId?: string;
		view?: string;
	}>();

	const [hubOpen, setHubOpen] = useState(false);
	const toast = useHubToast();
	// Real counts for the pill; the queries share their cache with the views
	// (the leads one reads the view's untouched-filters entry).
	const assetsQuery = useProjectAssetsQuery(projectId ?? "");
	const marketingQuery = useMarketingAssetsQuery(projectId ?? "");
	const leadsQuery = useLeadsInfiniteQuery(
		projectId ?? "",
		DEFAULT_LEAD_FILTERS,
	);

	const active = VIEWS.find((candidate) => candidate === view);
	if (!active) {
		// Unknown segment (stale deep link) — fall back to the project chat.
		return <Redirect href={projectId ? `/project/${projectId}` : "/"} />;
	}

	const assetsCount = assetsQuery.data?.length ?? 0;
	const marketingAssets = marketingQuery.data ?? [];
	const working = marketingAssets.filter(
		(asset) => asset.status === "queued" || asset.status === "generating",
	).length;
	// Whole-book lead counts ride along on every list page.
	const leadTotals = leadsQuery.data?.pages[0]?.totals;

	const sections: WorkspaceHubSection[] = [
		{
			view: "assets",
			icon: "imageTile",
			title: t("native.workspace.dock.assets"),
			stat: t("native.workspace.hub.statAssets", { count: assetsCount }),
			cardSub: t("native.workspace.hub.cardAssetsSub", {
				count: assetsCount,
			}),
		},
		{
			view: "marketing",
			icon: "megaphone",
			title: t("native.workspace.dock.marketing"),
			stat: t("native.workspace.hub.statMarketing", { count: working }),
			cardSub: t("native.workspace.hub.cardMarketingSub", {
				count: marketingAssets.length,
				working,
			}),
		},
		{
			view: "leads",
			icon: "users",
			title: t("native.workspace.dock.leads"),
			stat: t("native.workspace.hub.statLeads", {
				count: leadTotals?.today ?? 0,
			}),
			cardSub: t("native.workspace.hub.cardLeadsSub", {
				count: leadTotals?.total ?? 0,
				today: leadTotals?.today ?? 0,
			}),
		},
	];

	return (
		<View className="flex-1 bg-background">
			{/* Back pill to the project chat. The section's icon stands in for its
			    name — the view header right below already spells it out. */}
			<View
				className="flex-row items-center px-3.5 pb-1.5"
				style={{ paddingTop: insets.top + 8 }}
			>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t(`native.workspace.dock.${active}`)}
					onPress={() => router.back()}
					className="h-[38px] flex-row items-center gap-[7px] rounded-full border border-border bg-surface px-3.5 active:scale-95 dark:bg-surface-tertiary/65"
				>
					<View style={{ transform: [{ rotate: "180deg" }] }}>
						<WanditIcon name="arrowRight" size={13} color={foreground} />
					</View>
					<WanditIcon
						name={SECTION_ICONS[active]}
						size={15}
						color={foreground}
					/>
				</Pressable>
			</View>

			<View className="flex-1">
				<View
					className="flex-1"
					style={{ display: active === "leads" ? "flex" : "none" }}
				>
					<LeadsView projectId={projectId ?? ""} onToast={toast.show} />
				</View>
				<View
					className="flex-1"
					style={{ display: active === "marketing" ? "flex" : "none" }}
				>
					<MarketingView projectId={projectId ?? ""} onToast={toast.show} />
				</View>
				<View
					className="flex-1"
					style={{ display: active === "assets" ? "flex" : "none" }}
				>
					<AssetsView projectId={projectId ?? ""} onToast={toast.show} />
				</View>
			</View>

			<WorkspaceHubPill
				sections={sections}
				active={active}
				open={hubOpen}
				onOpenChange={setHubOpen}
				onSelect={(next) => router.setParams({ view: next })}
			/>
			<HubToast message={toast.message} />
		</View>
	);
}
