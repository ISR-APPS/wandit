import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { cn } from "heroui-native";
import { type ReactNode, useState } from "react";
import { View } from "react-native";

import {
	AppSelect,
	type AppSelectCloseProps,
	type AppSelectContentProps,
	type AppSelectOverlayProps,
	type AppSelectPortalProps,
} from "./select";
import {
	type AppSelectFilterOption,
	type AppSelectOption,
	AppSelectOptionItems,
	type AppSelectPresetProps,
	AppSelectPresetTrigger,
	AppSelectSearchInput,
	getAppSelectRootValueProps,
	useFilteredAppSelectOptions,
} from "./select-option-list";

type AppSelectBottomSheetContentProps = Extract<
	AppSelectContentProps,
	{ presentation: "bottom-sheet" }
>;

export type AppSelectBottomSheetProps<
	Option extends AppSelectOption = AppSelectOption,
> = AppSelectPresetProps<Option> & {
	closeProps?: AppSelectCloseProps;
	contentProps?: Omit<
		AppSelectBottomSheetContentProps,
		"children" | "presentation"
	>;
	filterOption?: AppSelectFilterOption<Option>;
	isSearchable?: boolean;
	overlay?: ReactNode;
	overlayProps?: Omit<AppSelectOverlayProps, "children">;
	portalProps?: Omit<AppSelectPortalProps, "children">;
	searchInputClassName?: string;
	searchPlaceholder?: string;
	showCloseButton?: boolean;
};

export function AppSelectBottomSheet<
	Option extends AppSelectOption = AppSelectOption,
>({
	closeOnSelect,
	closeProps,
	contentProps,
	defaultValue,
	emptyState,
	filterOption,
	isOptionDisabled,
	isSearchable = false,
	itemClassName,
	itemDescriptionClassName,
	itemIndicatorClassName,
	itemLabelClassName,
	listLabel,
	listLabelClassName,
	onOpenChange,
	onValueChange,
	options,
	overlay,
	overlayProps,
	placeholder = "Select one",
	portalProps,
	renderOption,
	renderTrigger,
	searchInputClassName,
	searchPlaceholder = "Search...",
	showCloseButton = true,
	showDividers = false,
	triggerClassName,
	value,
	valueClassName,
	...selectProps
}: AppSelectBottomSheetProps<Option>) {
	const [searchQuery, setSearchQuery] = useState("");
	const filteredOptions = useFilteredAppSelectOptions(
		options,
		searchQuery,
		filterOption,
	);

	const { className: overlayClassName, ...restOverlayProps } =
		overlayProps ?? {};
	const { contentContainerClassName, ...restContentProps } = contentProps ?? {};

	const shouldRenderHeader = Boolean(listLabel) || showCloseButton;

	return (
		<AppSelect
			presentation="bottom-sheet"
			{...getAppSelectRootValueProps({
				defaultValue,
				onValueChange,
				options,
				value,
			})}
			onOpenChange={(isOpen) => {
				if (!isOpen) {
					setSearchQuery("");
				}

				onOpenChange?.(isOpen);
			}}
			{...selectProps}
		>
			<AppSelectPresetTrigger
				options={options}
				placeholder={placeholder}
				renderTrigger={renderTrigger}
				triggerClassName={triggerClassName}
				valueClassName={valueClassName}
			/>
			<AppSelect.Portal {...portalProps}>
				{overlay ?? (
					<AppSelect.Overlay
						className={overlayClassName}
						{...restOverlayProps}
					/>
				)}
				<AppSelect.Content
					presentation="bottom-sheet"
					enableDynamicSizing={false}
					enableOverDrag={false}
					snapPoints={["45%"]}
					{...restContentProps}
					contentContainerClassName={cn("h-full", contentContainerClassName)}
				>
					<View className="gap-3 px-1 pb-3">
						{shouldRenderHeader ? (
							<View className="flex-row items-center justify-between gap-3">
								{listLabel ? (
									<AppSelect.ListLabel
										className={cn("flex-1", listLabelClassName)}
									>
										{listLabel}
									</AppSelect.ListLabel>
								) : (
									<View className="flex-1" />
								)}
								{showCloseButton ? (
									<AppSelect.Close variant="ghost" {...closeProps} />
								) : null}
							</View>
						) : null}
						{isSearchable ? (
							<AppSelectSearchInput
								className={searchInputClassName}
								onChangeText={setSearchQuery}
								placeholder={searchPlaceholder}
								value={searchQuery}
							/>
						) : null}
					</View>
					<BottomSheetScrollView keyboardShouldPersistTaps="handled">
						<AppSelectOptionItems
							closeOnSelect={closeOnSelect}
							emptyState={emptyState}
							isOptionDisabled={isOptionDisabled}
							itemClassName={itemClassName}
							itemDescriptionClassName={itemDescriptionClassName}
							itemIndicatorClassName={itemIndicatorClassName}
							itemLabelClassName={itemLabelClassName}
							onOptionPress={() => setSearchQuery("")}
							options={filteredOptions}
							renderOption={renderOption}
							showDividers={showDividers}
						/>
					</BottomSheetScrollView>
				</AppSelect.Content>
			</AppSelect.Portal>
		</AppSelect>
	);
}
