import { useTheme } from "next-themes";

import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function ColorModeSelector() {
	const { resolvedTheme, setTheme } = useTheme();

	return (
		<div className="flex flex-col gap-3">
			<Label>Color mode</Label>
			<ToggleGroup
				aria-label="Color mode"
				className="w-full"
				value={resolvedTheme}
				type="single"
				onValueChange={(value) => {
					if (value) {
						setTheme(value);
					}
				}}
			>
				<ToggleGroupItem variant="outline" className="grow" value="light">
					Light
				</ToggleGroupItem>
				<ToggleGroupItem variant="outline" className="grow" value="dark">
					Dark
				</ToggleGroupItem>
			</ToggleGroup>
		</div>
	);
}
