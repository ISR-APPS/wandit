import { Palette } from "lucide-react";

import {
	ColorModeSelector,
	ContentLayoutSelector,
	PresetSelector,
	ResetThemeButton,
	SidebarModeSelector,
	ThemeRadiusSelector,
	ThemeScaleSelector,
} from "@/components/theme-customizer";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";

export function ThemeCustomizerPanel() {
	const isMobile = useIsMobile();

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button size="icon-sm" variant="ghost">
					<Palette />
					<span className="sr-only">Customize appearance</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="me-4 w-80 p-4 shadow-xl lg:me-0"
				align={isMobile ? "center" : "end"}
			>
				<div className="flex flex-col gap-4">
					<PresetSelector />
					<ThemeScaleSelector />
					<ThemeRadiusSelector />
					<ColorModeSelector />
					<ContentLayoutSelector />
					<SidebarModeSelector />
				</div>
				<ResetThemeButton />
			</PopoverContent>
		</Popover>
	);
}
