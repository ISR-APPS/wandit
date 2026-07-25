import { useThemeConfig } from "@/components/active-theme";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ContentLayout } from "@/lib/themes";

export function ContentLayoutSelector() {
	const { theme, setTheme } = useThemeConfig();

	return (
		<div className="hidden flex-col gap-3 lg:flex">
			<Label>Content layout</Label>
			<ToggleGroup
				aria-label="Content layout"
				className="w-full"
				value={theme.contentLayout}
				type="single"
				onValueChange={(value) => {
					if (value) {
						setTheme({
							...theme,
							contentLayout: value as ContentLayout,
						});
					}
				}}
			>
				<ToggleGroupItem variant="outline" className="grow" value="full">
					Full
				</ToggleGroupItem>
				<ToggleGroupItem variant="outline" className="grow" value="centered">
					Centered
				</ToggleGroupItem>
			</ToggleGroup>
		</div>
	);
}
