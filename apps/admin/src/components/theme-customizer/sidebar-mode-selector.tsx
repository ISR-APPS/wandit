import { Label } from "@/components/ui/label";
import { useSidebar } from "@/components/ui/sidebar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function SidebarModeSelector() {
	const { open, setOpen } = useSidebar();

	return (
		<div className="hidden flex-col gap-3 lg:flex">
			<Label>Sidebar mode</Label>
			<ToggleGroup
				aria-label="Sidebar mode"
				className="w-full"
				type="single"
				value={open ? "full" : "icon"}
				onValueChange={(value) => {
					if (value) {
						setOpen(value === "full");
					}
				}}
			>
				<ToggleGroupItem variant="outline" className="grow" value="full">
					Default
				</ToggleGroupItem>
				<ToggleGroupItem variant="outline" className="grow" value="icon">
					Icon
				</ToggleGroupItem>
			</ToggleGroup>
		</div>
	);
}
