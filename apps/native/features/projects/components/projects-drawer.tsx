import { localeMeta, locales } from "@wandit/internationalization";
import { useTranslation } from "@wandit/internationalization/react";
import { router } from "expo-router";
import { Button, cn } from "heroui-native";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocale } from "@/contexts/locale-context";
import { authClient } from "@/lib/auth-client";

import { MOCK_PROJECTS } from "../lib/constants";
import { ProjectListItem } from "./project-list-item";

// Minimal structural type: @react-navigation/drawer is not a direct
// dependency (pnpm isolated node-linker), so type only what is used.
type ProjectsDrawerProps = {
	navigation: {
		closeDrawer: () => void;
	};
};

export function ProjectsDrawer({ navigation }: ProjectsDrawerProps) {
	const insets = useSafeAreaInsets();
	const { data: session } = authClient.useSession();
	const { t } = useTranslation();
	const { locale, setLocale } = useLocale();

	function openProject(projectId: string) {
		navigation.closeDrawer();
		router.push(`/project/${projectId}`);
	}

	return (
		<View
			className="flex-1"
			style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }}
		>
			<View className="px-4 pb-3">
				<Text className="font-semibold text-foreground text-lg">
					{t("native.drawer.projects")}
				</Text>
			</View>

			{/* TODO: fetch the real project list (features/projects/api/). */}
			<FlatList
				data={MOCK_PROJECTS}
				keyExtractor={(project) => project.id}
				contentContainerStyle={{ paddingHorizontal: 8 }}
				renderItem={({ item }) => (
					<ProjectListItem
						project={item}
						onPress={() => openProject(item.id)}
					/>
				)}
			/>

			<View className="gap-3 border-border border-t px-4 pt-3">
				<View className="gap-2">
					<Text className="text-muted text-xs uppercase">
						{t("native.drawer.language")}
					</Text>
					<View className="flex-row gap-2">
						{locales.map((item) => {
							const isActive = item === locale;
							return (
								<Pressable
									key={item}
									onPress={() => setLocale(item)}
									accessibilityRole="button"
									accessibilityState={{ selected: isActive }}
									className={cn(
										"flex-1 items-center rounded-full px-3 py-1.5",
										isActive ? "bg-accent" : "bg-surface-secondary",
									)}
								>
									<Text
										className={cn(
											"font-medium text-sm",
											isActive ? "text-accent-foreground" : "text-muted",
										)}
									>
										{localeMeta[item].nativeLabel}
									</Text>
								</Pressable>
							);
						})}
					</View>
				</View>
				<Text numberOfLines={1} className="text-muted text-sm">
					{session?.user?.email}
				</Text>
				<Button
					variant="secondary"
					size="sm"
					onPress={() => authClient.signOut()}
				>
					<Button.Label>{t("native.drawer.signOut")}</Button.Label>
				</Button>
			</View>
		</View>
	);
}
