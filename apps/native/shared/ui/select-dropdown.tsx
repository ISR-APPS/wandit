import { cn } from "heroui-native";

import {
  AppSelect,
  type AppSelectContentProps,
  type AppSelectOverlayProps,
  type AppSelectPortalProps,
} from "./select";
import {
  AppSelectOptionItems,
  AppSelectPresetTrigger,
  getAppSelectRootValueProps,
  type AppSelectOption,
  type AppSelectPresetProps,
} from "./select-option-list";

type AppSelectPopoverContentProps = Extract<
  AppSelectContentProps,
  { presentation: "popover" }
>;

export type AppSelectDropdownProps<
  Option extends AppSelectOption = AppSelectOption,
> = AppSelectPresetProps<Option> & {
  contentProps?: Omit<
    AppSelectPopoverContentProps,
    "children" | "presentation"
  >;
  overlayProps?: Omit<AppSelectOverlayProps, "children">;
  portalProps?: Omit<AppSelectPortalProps, "children">;
};

export function AppSelectDropdown<
  Option extends AppSelectOption = AppSelectOption,
>({
  closeOnSelect,
  contentProps,
  defaultValue,
  emptyState,
  isOptionDisabled,
  itemClassName,
  itemDescriptionClassName,
  itemIndicatorClassName,
  itemLabelClassName,
  listLabel,
  listLabelClassName,
  onValueChange,
  options,
  overlayProps,
  placeholder = "Select one",
  portalProps,
  renderOption,
  renderTrigger,
  showDividers = true,
  triggerClassName,
  value,
  valueClassName,
  ...selectProps
}: AppSelectDropdownProps<Option>) {
  const { className: overlayClassName, ...restOverlayProps } =
    overlayProps ?? {};
  const { className: contentClassName, ...restContentProps } =
    contentProps ?? {};

  return (
    <AppSelect
      presentation="popover"
      {...getAppSelectRootValueProps({
        defaultValue,
        onValueChange,
        options,
        value,
      })}
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
        <AppSelect.Overlay
          className={cn("bg-transparent", overlayClassName)}
          {...restOverlayProps}
        />
        <AppSelect.Content
          presentation="popover"
          width="trigger"
          {...restContentProps}
          className={contentClassName}
        >
          {listLabel ? (
            <AppSelect.ListLabel className={cn("mb-2", listLabelClassName)}>
              {listLabel}
            </AppSelect.ListLabel>
          ) : null}
          <AppSelectOptionItems
            closeOnSelect={closeOnSelect}
            emptyState={emptyState}
            isOptionDisabled={isOptionDisabled}
            itemClassName={itemClassName}
            itemDescriptionClassName={itemDescriptionClassName}
            itemIndicatorClassName={itemIndicatorClassName}
            itemLabelClassName={itemLabelClassName}
            options={options}
            renderOption={renderOption}
            showDividers={showDividers}
          />
        </AppSelect.Content>
      </AppSelect.Portal>
    </AppSelect>
  );
}
