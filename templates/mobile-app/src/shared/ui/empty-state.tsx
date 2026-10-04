/**
 * Empty state: an icon, one title, one sentence, and the action that fills
 * the screen. Every list or data screen shows it when it has nothing to show.
 */
import type { ReactNode } from "react";
import { View } from "react-native";

import { AppText } from "./app-text";
import { AppIcon, type AppIconName } from "./icon";

/** The props of `EmptyState`. Every text comes translated from the screen. */
export type EmptyStateProps = {
	/** An outline icon that names the missing thing, for example `calendar-outline`. */
	icon: AppIconName;
	title: string;
	/** One sentence: why the screen is empty and what the user can do. */
	description: string;
	/** The button that fills the screen, for example "Add your first habit". */
	action?: ReactNode;
};

/** A centered icon, title, sentence, and optional action for a screen with no data. */
export function EmptyState({
	icon,
	title,
	description,
	action,
}: EmptyStateProps) {
	return (
		<View className="items-center gap-3 px-6 py-10">
			<View className="size-16 items-center justify-center rounded-full bg-surface-secondary">
				<AppIcon colorClassName="accent-muted" name={icon} size={28} />
			</View>
			<AppText className="text-center" variant="heading">
				{title}
			</AppText>
			<AppText className="text-center" variant="caption">
				{description}
			</AppText>
			{action}
		</View>
	);
}
