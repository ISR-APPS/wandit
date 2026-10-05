/**
 * Empty state: art or an icon badge, one title, one sentence, and the action that
 * fills the screen. Every list or data screen shows it when it has nothing to show.
 * The design world of the app gives the art (design-worlds-mobile skill).
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
	/**
	 * The art of the world in place of the icon badge: an SVG composition or an image
	 * from `generate_image`. The icon stays the fallback.
	 */
	art?: ReactNode;
};

/** Art (or an accent icon badge), title, sentence, and optional action for a screen with no data. */
export function EmptyState({
	icon,
	title,
	description,
	action,
	art,
}: EmptyStateProps) {
	return (
		<View className="items-center gap-3 px-6 py-10">
			{art ?? (
				<View className="mb-2 size-20 items-center justify-center rounded-3xl bg-accent-soft">
					<AppIcon colorClassName="accent-accent" name={icon} size={34} />
				</View>
			)}
			<AppText className="text-center" variant="heading">
				{title}
			</AppText>
			<AppText className="max-w-72 text-center" variant="caption">
				{description}
			</AppText>
			{action}
		</View>
	);
}
