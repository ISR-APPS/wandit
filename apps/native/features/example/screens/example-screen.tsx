import { useState } from "react";
import {
	ActivityIndicator,
	FlatList,
	Pressable,
	Text,
	TextInput,
	View,
} from "react-native";

import {
	useCreateExample,
	useDeleteExample,
} from "@/features/example/api/example.mutations";
import { useExamples } from "@/features/example/api/example.queries";
import { ExampleCard } from "@/features/example/components/example-card";
import { useExampleFilters } from "@/features/example/lib/use-example-filters";

/**
 * example-screen.tsx — the whole thing a route renders.
 *
 * This is the shape EVERY data-driven screen in the app follows, so learn it here:
 *   1. READ hooks (useExamples) → data + loading/error
 *   2. WRITE hooks (useCreateExample/useDeleteExample) → actions
 *   3. a feature UI hook (useExampleFilters) → local view state (search/sort)
 *   4. components (ExampleCard) → render each item
 * The screen WIRES these together. It never calls the server directly.
 *
 * The route file (app/.../example.tsx) imports this screen and renders it — that
 * is the only place a screen is imported, which is why screens are left out of the
 * feature's index.ts barrel.
 */
export function ExampleScreen() {
	const { data: examples, isLoading, isError } = useExamples();
	const createExample = useCreateExample();
	const deleteExample = useDeleteExample();
	const { search, setSearch, visibleExamples } = useExampleFilters(
		examples ?? [],
	);
	const [title, setTitle] = useState("");

	if (isLoading) {
		return (
			<View className="flex-1 items-center justify-center">
				<ActivityIndicator />
			</View>
		);
	}

	if (isError) {
		return (
			<View className="flex-1 items-center justify-center p-6">
				<Text className="text-center text-red-500">
					Could not load examples.
				</Text>
			</View>
		);
	}

	return (
		<View className="flex-1 gap-4 p-4">
			<TextInput
				className="rounded-xl border border-neutral-200 px-4 py-3"
				onChangeText={setSearch}
				placeholder="Search examples"
				value={search}
			/>

			<View className="flex-row gap-2">
				<TextInput
					className="flex-1 rounded-xl border border-neutral-200 px-4 py-3"
					onChangeText={setTitle}
					placeholder="New example title"
					value={title}
				/>
				<Pressable
					className="items-center justify-center rounded-xl bg-neutral-900 px-4"
					disabled={createExample.isPending || !title.trim()}
					onPress={() => {
						createExample.mutate(
							{ title: title.trim() },
							{ onSuccess: () => setTitle("") },
						);
					}}
				>
					<Text className="font-semibold text-white">Add</Text>
				</Pressable>
			</View>

			<FlatList
				contentContainerStyle={{ gap: 12 }}
				data={visibleExamples}
				keyExtractor={(item) => item.id}
				ListEmptyComponent={
					<Text className="text-center text-neutral-400">No examples yet.</Text>
				}
				renderItem={({ item }) => (
					<ExampleCard
						example={item}
						onDelete={(id) => deleteExample.mutate(id)}
					/>
				)}
			/>
		</View>
	);
}
