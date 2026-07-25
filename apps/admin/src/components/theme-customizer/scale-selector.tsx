import { BanIcon } from "lucide-react";

import { useThemeConfig } from "@/components/active-theme";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ThemeScale } from "@/lib/themes";

export function ThemeScaleSelector() {
	const { theme, setTheme } = useThemeConfig();

	return (
		<div className="flex flex-col gap-3">
			<Label>Scale</Label>
			<ToggleGroup
				aria-label="Interface scale"
				className="w-full"
				value={theme.scale}
				type="single"
				onValueChange={(value) => {
					if (value) {
						setTheme({ ...theme, scale: value as ThemeScale });
					}
				}}
			>
				<ToggleGroupItem variant="outline" className="grow" value="none">
					<BanIcon />
					<span className="sr-only">Default scale</span>
				</ToggleGroupItem>
				<ToggleGroupItem variant="outline" className="grow" value="sm">
					XS
				</ToggleGroupItem>
				<ToggleGroupItem variant="outline" className="grow" value="lg">
					LG
				</ToggleGroupItem>
			</ToggleGroup>
		</div>
	);
}
