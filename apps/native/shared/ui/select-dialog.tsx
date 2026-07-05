import { cn } from "heroui-native";
import { type ReactNode, useState } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	useWindowDimensions,
	View,
} from "react-native";

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

type AppSelectDialogContentProps = Extract<
	AppSelectContentProps,
	{ presentation: "dialog" }
>;

export type AppSelectDialogProps<
	Option extends AppSelectOption = AppSelectOption,
> = AppSelectPresetProps<Option> & {
	closeProps?: AppSelectCloseProps;
	contentProps?: Omit<AppSelectDialogContentProps, "children" | "presentation">;
	filterOption?: AppSelectFilterOption<Option>;
	isSearchable?: boolean;
	maxHeightRatio?: number;
	overlay?: ReactNode;
	overlayProps?: Omit<AppSelectOverlayProps, "children">;
	portalProps?: Omit<AppSelectPortalProps, "children">;
	searchInputClassName?: string;
	searchPlaceholder?: string;
	showCloseButton?: boolean;
};

export function AppSelectDialog<
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
	maxHeightRatio = 0.62,
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
}: AppSelectDialogProps<Option>) {
	const [searchQuery, setSearchQuery] = useState("");
	const { height } = useWindowDimensions();
	const filteredOptions = useFilteredAppSelectOptions(
		options,
		searchQuery,
		filterOption,
	);

	const { className: overlayClassName, ...restOverlayProps } =
		overlayProps ?? {};
	const {
		classNames: contentClassNames,
		style: contentStyle,
		...restContentProps
	} = contentProps ?? {};

	const maxHeight = height * maxHeightRatio;
	const shouldRenderHeader = Boolean(listLabel) || showCloseButton;

	return (
		<AppSelect
			presentation="dialog"
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
				<KeyboardAvoidingView
					behavior={Platform.select({ ios: "padding", default: undefined })}
					className="w-full"
				>
					<AppSelect.Content
						presentation="dialog"
						{...restContentProps}
						classNames={{
							...contentClassNames,
							content: cn("gap-3 rounded-3xl", contentClassNames?.content),
						}}
						style={[{ maxHeight }, contentStyle]}
					>
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
								autoFocus
								className={searchInputClassName}
								onChangeText={setSearchQuery}
								placeholder={searchPlaceholder}
								value={searchQuery}
							/>
						) : null}
						<ScrollView keyboardShouldPersistTaps="handled">
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
						</ScrollView>
					</AppSelect.Content>
				</KeyboardAvoidingView>
			</AppSelect.Portal>
		</AppSelect>
	);
}
