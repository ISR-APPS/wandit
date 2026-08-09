import { cn, useThemeColor } from "heroui-native";
import { Fragment, type ReactElement, type ReactNode, useMemo } from "react";
import { Keyboard, TextInput, View } from "react-native";

import { AppText } from "./app-text";
import {
	AppSelect,
	type AppSelectItemProps,
	type AppSelectProps,
	useAppSelect,
} from "./select";
import { AppSeparator } from "./separator";

export type AppSelectOption = {
	description?: string;
	isDisabled?: boolean;
	label: string;
	value: string;
};

type AppSelectPrimitiveOption = {
	label: string;
	value: string;
};

type AppSelectPrimitiveValue =
	| AppSelectPrimitiveOption
	| (AppSelectPrimitiveOption | undefined)[]
	| undefined;

export type AppSelectTriggerRenderProps<
	Option extends AppSelectOption = AppSelectOption,
> = {
	placeholder: string;
	value: Option | undefined;
};

export type AppSelectOptionRenderProps<
	Option extends AppSelectOption = AppSelectOption,
> = {
	isDisabled: boolean;
	isSelected: boolean;
	option: Option;
	value: string;
};

export type AppSelectPresetProps<
	Option extends AppSelectOption = AppSelectOption,
> = Omit<
	AppSelectProps,
	| "children"
	| "defaultValue"
	| "onValueChange"
	| "presentation"
	| "selectionMode"
	| "value"
> & {
	closeOnSelect?: AppSelectItemProps["closeOnPress"];
	defaultValue?: Option;
	emptyState?: ReactNode;
	isOptionDisabled?: (option: Option) => boolean;
	itemClassName?: string;
	itemDescriptionClassName?: string;
	itemIndicatorClassName?: string;
	itemLabelClassName?: string;
	listLabel?: ReactNode;
	listLabelClassName?: string;
	onValueChange?: (value: Option | undefined) => void;
	options: readonly Option[];
	placeholder?: string;
	renderOption?: (props: AppSelectOptionRenderProps<Option>) => ReactNode;
	renderTrigger?: (props: AppSelectTriggerRenderProps<Option>) => ReactElement;
	showDividers?: boolean;
	triggerClassName?: string;
	value?: Option;
	valueClassName?: string;
};

type AppSelectRootValueProps<Option extends AppSelectOption> = Pick<
	AppSelectPresetProps<Option>,
	"defaultValue" | "onValueChange" | "options" | "value"
>;

export type AppSelectFilterOption<
	Option extends AppSelectOption = AppSelectOption,
> = (option: Option, query: string) => boolean;

type AppSelectPresetTriggerProps<
	Option extends AppSelectOption = AppSelectOption,
> = {
	options: readonly Option[];
	placeholder: string;
	renderTrigger?: AppSelectPresetProps<Option>["renderTrigger"];
	triggerClassName?: string;
	valueClassName?: string;
};

type AppSelectOptionItemsProps<
	Option extends AppSelectOption = AppSelectOption,
> = {
	closeOnSelect?: AppSelectItemProps["closeOnPress"];
	emptyState?: ReactNode;
	isOptionDisabled?: (option: Option) => boolean;
	itemClassName?: string;
	itemDescriptionClassName?: string;
	itemIndicatorClassName?: string;
	itemLabelClassName?: string;
	onOptionPress?: (option: Option) => void;
	options: readonly Option[];
	renderOption?: AppSelectPresetProps<Option>["renderOption"];
	showDividers?: boolean;
};

type AppSelectSearchInputProps = {
	autoFocus?: boolean;
	className?: string;
	onChangeText: (value: string) => void;
	placeholder?: string;
	value: string;
};

export function getAppSelectOptionFromValue<
	Option extends AppSelectOption = AppSelectOption,
>(
	options: readonly Option[],
	selectedValue: AppSelectPrimitiveValue,
): Option | undefined {
	if (!selectedValue || Array.isArray(selectedValue)) {
		return undefined;
	}

	return options.find((option) => option.value === selectedValue.value);
}

function getAppSelectPrimitiveOption(
	option: AppSelectOption | undefined,
): AppSelectPrimitiveOption | undefined {
	if (!option) {
		return undefined;
	}

	return {
		label: option.label,
		value: option.value,
	};
}

export function getAppSelectRootValueProps<
	Option extends AppSelectOption = AppSelectOption,
>({
	defaultValue,
	onValueChange,
	options,
	value,
}: AppSelectRootValueProps<Option>) {
	const handleValueChange: AppSelectProps["onValueChange"] = (
		selectedValue,
	) => {
		onValueChange?.(getAppSelectOptionFromValue(options, selectedValue));
	};

	return {
		defaultValue: getAppSelectPrimitiveOption(defaultValue),
		onValueChange: onValueChange ? handleValueChange : undefined,
		value: getAppSelectPrimitiveOption(value),
	};
}

export function filterAppSelectOptions<
	Option extends AppSelectOption = AppSelectOption,
>(
	options: readonly Option[],
	query: string,
	filterOption?: AppSelectFilterOption<Option>,
) {
	const normalizedQuery = query.trim().toLowerCase();

	if (!normalizedQuery) {
		return options;
	}

	return options.filter((option) => {
		if (filterOption) {
			return filterOption(option, normalizedQuery);
		}

		return [option.label, option.description]
			.filter((value): value is string => typeof value === "string")
			.some((value) => value.toLowerCase().includes(normalizedQuery));
	});
}

export function useFilteredAppSelectOptions<
	Option extends AppSelectOption = AppSelectOption,
>(
	options: readonly Option[],
	query: string,
	filterOption?: AppSelectFilterOption<Option>,
) {
	return useMemo(
		() => filterAppSelectOptions(options, query, filterOption),
		[filterOption, options, query],
	);
}

export function AppSelectPresetTrigger<
	Option extends AppSelectOption = AppSelectOption,
>({
	options,
	placeholder,
	renderTrigger,
	triggerClassName,
	valueClassName,
}: AppSelectPresetTriggerProps<Option>) {
	const { value } = useAppSelect();
	const selectedOption = getAppSelectOptionFromValue(options, value);

	if (renderTrigger) {
		return (
			<AppSelect.Trigger asChild variant="unstyled">
				{renderTrigger({ placeholder, value: selectedOption })}
			</AppSelect.Trigger>
		);
	}

	return (
		<AppSelect.Trigger className={triggerClassName}>
			<AppSelect.Value
				className={valueClassName}
				numberOfLines={1}
				placeholder={placeholder}
			/>
			<AppSelect.TriggerIndicator />
		</AppSelect.Trigger>
	);
}

export function AppSelectEmptyState({
	children = "No options found",
}: {
	children?: ReactNode;
}) {
	return (
		<View className="items-center justify-center px-4 py-6">
			{typeof children === "string" ? (
				<AppText className="text-center text-muted">{children}</AppText>
			) : (
				children
			)}
		</View>
	);
}

export function AppSelectSearchInput({
	autoFocus,
	className,
	onChangeText,
	placeholder = "Search...",
	value,
}: AppSelectSearchInputProps) {
	const themeColorMuted = useThemeColor("muted");

	return (
		<TextInput
			autoCapitalize="none"
			autoCorrect={false}
			autoFocus={autoFocus}
			className={cn(
				"h-11 rounded-xl bg-surface-secondary/80 px-3 text-base text-foreground",
				className,
			)}
			onChangeText={onChangeText}
			onSubmitEditing={() => Keyboard.dismiss()}
			placeholder={placeholder}
			placeholderTextColor={themeColorMuted}
			returnKeyType="search"
			value={value}
		/>
	);
}

export function AppSelectOptionItems<
	Option extends AppSelectOption = AppSelectOption,
>({
	closeOnSelect,
	emptyState,
	isOptionDisabled,
	itemClassName,
	itemDescriptionClassName,
	itemIndicatorClassName,
	itemLabelClassName,
	onOptionPress,
	options,
	renderOption,
	showDividers = false,
}: AppSelectOptionItemsProps<Option>) {
	if (options.length === 0) {
		return <AppSelectEmptyState>{emptyState}</AppSelectEmptyState>;
	}

	return (
		<>
			{options.map((option, index) => {
				const isLast = index === options.length - 1;
				const disabled = isOptionDisabled?.(option) ?? option.isDisabled;

				return (
					<Fragment key={option.value}>
						<AppSelect.Item
							className={itemClassName}
							closeOnPress={closeOnSelect}
							disabled={disabled}
							label={option.label}
							onPress={() => {
								Keyboard.dismiss();
								onOptionPress?.(option);
							}}
							value={option.value}
						>
							{renderOption ? (
								(itemState) => renderOption({ option, ...itemState })
							) : (
								<>
									<View className="flex-1">
										<AppSelect.ItemLabel className={itemLabelClassName} />
										{option.description ? (
											<AppSelect.ItemDescription
												className={itemDescriptionClassName}
											>
												{option.description}
											</AppSelect.ItemDescription>
										) : null}
									</View>
									<AppSelect.ItemIndicator className={itemIndicatorClassName} />
								</>
							)}
						</AppSelect.Item>
						{showDividers && !isLast ? <AppSeparator /> : null}
					</Fragment>
				);
			})}
		</>
	);
}
