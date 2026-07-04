import { cn } from "heroui-native";
import {
  FlatList,
  type FlatListProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import {
  DEFAULT_SCREEN_CONTENT_CLASS_NAME,
  type ScreenInsetProps,
  useScreenInsetStyle,
} from "@/shared/ui/screen-layout";

type ScreenFlatListProps<ItemT> = FlatListProps<ItemT> &
  ScreenInsetProps & {
    className?: string;
    contentContainerClassName?: string;
    contentContainerStyle?: StyleProp<ViewStyle>;
  };

export function ScreenFlatList<ItemT>({
  className,
  contentContainerClassName,
  contentContainerStyle,
  topInsetMode,
  includeTopInset,
  includeBottomInset,
  topSpacing,
  bottomSpacing,
  showsVerticalScrollIndicator = false,
  keyboardDismissMode = "on-drag",
  keyboardShouldPersistTaps = "handled",
  ...props
}: ScreenFlatListProps<ItemT>) {
  const insetStyle = useScreenInsetStyle({
    topInsetMode,
    includeTopInset,
    includeBottomInset,
    topSpacing,
    bottomSpacing,
  });

  return (
    <FlatList
      className={cn("flex-1 bg-background", className)}
      contentContainerClassName={cn(DEFAULT_SCREEN_CONTENT_CLASS_NAME, contentContainerClassName)}
      contentContainerStyle={[
        insetStyle,
        {
          flexGrow: 1,
        },
        contentContainerStyle,
      ]}
      keyboardDismissMode={keyboardDismissMode}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      {...props}
    />
  );
}
