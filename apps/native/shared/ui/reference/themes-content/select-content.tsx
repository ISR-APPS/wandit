import { Label, Select } from "heroui-native";
import { useState } from "react";
import { View } from "react-native";

type SelectOption = {
	value: string;
	label: string;
};

const CATEGORIES: SelectOption[] = [
	{ value: "electronics", label: "Electronics" },
	{ value: "clothing", label: "Clothing" },
	{ value: "home", label: "Home & Garden" },
	{ value: "sports", label: "Sports" },
	{ value: "books", label: "Books" },
];

const SORT_OPTIONS: SelectOption[] = [
	{ value: "newest", label: "Newest First" },
	{ value: "price-low", label: "Price: Low to High" },
	{ value: "price-high", label: "Price: High to Low" },
	{ value: "popular", label: "Most Popular" },
];

export const SelectContent = () => {
	const [category, setCategory] = useState<SelectOption | undefined>();
	const [sortBy, setSortBy] = useState<SelectOption | undefined>();

	return (
		<View className="gap-4">
			<View>
				<Label className="mb-1 ml-1.5">Category</Label>
				<Select
					value={category}
					onValueChange={(value) => {
						const found = CATEGORIES.find((c) => c.value === value?.value);
						setCategory(found);
					}}
				>
					<Select.Trigger>
						<Select.Value placeholder="Select a category" />
						<Select.TriggerIndicator />
					</Select.Trigger>
					<Select.Portal>
						<Select.Overlay />
						<Select.Content presentation="popover" width="trigger" offset={0}>
							{CATEGORIES.map((item) => (
								<Select.Item
									key={item.value}
									value={item.value}
									label={item.label}
								>
									<Select.ItemLabel />
									<Select.ItemIndicator />
								</Select.Item>
							))}
						</Select.Content>
					</Select.Portal>
				</Select>
			</View>
			<View>
				<Label className="mb-1 ml-1.5">Sort by</Label>
				<Select
					value={sortBy}
					onValueChange={(value) => {
						const found = SORT_OPTIONS.find((s) => s.value === value?.value);
						setSortBy(found);
					}}
				>
					<Select.Trigger>
						<Select.Value placeholder="Sort results" />
						<Select.TriggerIndicator />
					</Select.Trigger>
					<Select.Portal>
						<Select.Overlay />
						<Select.Content presentation="popover" width={260}>
							{SORT_OPTIONS.map((item) => (
								<Select.Item
									key={item.value}
									value={item.value}
									label={item.label}
								>
									<Select.ItemLabel />
									<Select.ItemIndicator />
								</Select.Item>
							))}
						</Select.Content>
					</Select.Portal>
				</Select>
			</View>
		</View>
	);
};
