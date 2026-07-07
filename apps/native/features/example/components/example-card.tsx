import { Pressable, Text, View } from "react-native";

import type { Example } from "@/features/example/lib/example.schemas";

/**
 * example-card.tsx — a component used ONLY by this feature.
 *
 * It is "dumb": it takes data + callbacks as props and renders them. It does NOT
 * fetch and knows nothing about react-query. Keep components like this presentational
 * so they are trivial to reuse and test. If another feature ever needs this card,
 * that is the signal to promote it up to shared/components.
 *
 * (Styling here uses plain className utilities for illustration — swap in your
 * design tokens / shared/ui App* components in a real feature.)
 */
type ExampleCardProps = {
	example: Example;
	onDelete: (id: string) => void;
};

export function ExampleCard({ example, onDelete }: ExampleCardProps) {
	return (
		<View className="flex-row items-center justify-between rounded-2xl border border-neutral-200 p-4">
			<Text className="text-base font-semibold text-neutral-900">
				{example.title}
			</Text>

			<Pressable hitSlop={8} onPress={() => onDelete(example.id)}>
				<Text className="text-sm font-medium text-red-500">Delete</Text>
			</Pressable>
		</View>
	);
}
