import { BanIcon } from "lucide-react";

import { useThemeConfig } from "@/components/active-theme";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ThemeRadius } from "@/lib/themes";

export function ThemeRadiusSelector() {
	const { theme, setTheme } = useThemeConfig();

	return (
		<div className="flex flex-col gap-3">
			<Label>Radius</Label>
			<ToggleGroup
				aria-label="Corner radius"
				className="w-full"
				value={theme.radius}
				type="single"
				onValueChange={(value) => {
					if (value) {
						setTheme({ ...theme, radius: value as ThemeRadius });
					}
				}}
			>
				<ToggleGroupItem variant="outline" className="grow" value="none">
					<BanIcon />
					<span className="sr-only">No radius</span>
				</ToggleGroupItem>
				<ToggleGroupItem variant="outline" className="grow" value="sm">
					SM
				</ToggleGroupItem>
				<ToggleGroupItem variant="outline" className="grow" value="md">
					MD
				</ToggleGroupItem>
				<ToggleGroupItem variant="outline" className="grow" value="lg">
					LG
				</ToggleGroupItem>
				<ToggleGroupItem variant="outline" className="grow" value="xl">
					XL
				</ToggleGroupItem>
			</ToggleGroup>
		</div>
	);
}
