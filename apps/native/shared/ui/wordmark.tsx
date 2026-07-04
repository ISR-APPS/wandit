import { cn } from "heroui-native";
import { View, type ViewProps } from "react-native";

import { AppText } from "@/shared/ui/app-text";

type FitCalWordmarkProps = ViewProps;

export function FitCalWordmark({ className, ...props }: FitCalWordmarkProps) {
  return (
    <View className={cn("flex-row items-center", className)} {...props}>
      <AppText
        allowFontScaling={false}
        className="text-[20px] font-extrabold leading-6 text-foreground"
      >
        Fitcal
      </AppText>
      <View className="ml-0.5 rounded-[5px] bg-accent px-1 py-0.5">
        <AppText
          allowFontScaling={false}
          className="text-[18px] font-extrabold leading-5 text-accent-foreground"
        >
          AI
        </AppText>
      </View>
    </View>
  );
}
