/**
 * One Phosphor icon for each trophy of the catalog. TrophyMedallion reads it.
 * The `satisfies` check fails the build when a catalog id has no icon.
 */
import type { Icon } from "@phosphor-icons/react";
import { AppWindowIcon } from "@phosphor-icons/react/AppWindow";
import { BirdIcon } from "@phosphor-icons/react/Bird";
import { BrainIcon } from "@phosphor-icons/react/Brain";
import { BugIcon } from "@phosphor-icons/react/Bug";
import { BuildingsIcon } from "@phosphor-icons/react/Buildings";
import { CalendarCheckIcon } from "@phosphor-icons/react/CalendarCheck";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/ClockCounterClockwise";
import { CloudRainIcon } from "@phosphor-icons/react/CloudRain";
import { CompassIcon } from "@phosphor-icons/react/Compass";
import { CrownIcon } from "@phosphor-icons/react/Crown";
import { DesktopIcon } from "@phosphor-icons/react/Desktop";
import { DeviceMobileIcon } from "@phosphor-icons/react/DeviceMobile";
import { DevicesIcon } from "@phosphor-icons/react/Devices";
import { FireIcon } from "@phosphor-icons/react/Fire";
import { GitBranchIcon } from "@phosphor-icons/react/GitBranch";
import { GlobeIcon } from "@phosphor-icons/react/Globe";
import { HammerIcon } from "@phosphor-icons/react/Hammer";
import { HandHeartIcon } from "@phosphor-icons/react/HandHeart";
import { HandshakeIcon } from "@phosphor-icons/react/Handshake";
import { HeartIcon } from "@phosphor-icons/react/Heart";
import { ImagesIcon } from "@phosphor-icons/react/Images";
import { LightbulbFilamentIcon } from "@phosphor-icons/react/LightbulbFilament";
import { LightningIcon } from "@phosphor-icons/react/Lightning";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/MagnifyingGlass";
import { MedalIcon } from "@phosphor-icons/react/Medal";
import { MegaphoneIcon } from "@phosphor-icons/react/Megaphone";
import { MetronomeIcon } from "@phosphor-icons/react/Metronome";
import { PaintBrushIcon } from "@phosphor-icons/react/PaintBrush";
import { PaletteIcon } from "@phosphor-icons/react/Palette";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/PaperPlaneTilt";
import { PersonSimpleRunIcon } from "@phosphor-icons/react/PersonSimpleRun";
import { RocketLaunchIcon } from "@phosphor-icons/react/RocketLaunch";
import { ShapesIcon } from "@phosphor-icons/react/Shapes";
import { ShootingStarIcon } from "@phosphor-icons/react/ShootingStar";
import { SparkleIcon } from "@phosphor-icons/react/Sparkle";
import { StudentIcon } from "@phosphor-icons/react/Student";
import { ToolboxIcon } from "@phosphor-icons/react/Toolbox";
import { TrainIcon } from "@phosphor-icons/react/Train";
import { UserPlusIcon } from "@phosphor-icons/react/UserPlus";
import { UsersThreeIcon } from "@phosphor-icons/react/UsersThree";
import type { TrophyId } from "@wandit/contracts";

/** The icon of each trophy. The medallion draws it duotone when unlocked and regular when locked. */
export const TROPHY_ICONS = {
	first_project: LightbulbFilamentIcon,
	projects_5: ToolboxIcon,
	projects_25: BuildingsIcon,
	first_app: AppWindowIcon,
	builds_50: LightningIcon,
	builds_500: BrainIcon,
	marathon: PersonSimpleRunIcon,
	first_publish: RocketLaunchIcon,
	publishes_10: PaperPlaneTiltIcon,
	publishes_50: TrainIcon,
	live_3: ShootingStarIcon,
	own_domain: GlobeIcon,
	mobile_build: DeviceMobileIcon,
	desktop_build: DesktopIcon,
	polyglot: DevicesIcon,
	art_director: PaletteIcon,
	images_25: ImagesIcon,
	research_25: MagnifyingGlassIcon,
	time_traveler: ClockCounterClockwiseIcon,
	explorer: CompassIcon,
	open_source: GitBranchIcon,
	first_lead: UserPlusIcon,
	leads_100: UsersThreeIcon,
	ambassador: MegaphoneIcon,
	mentor: HandHeartIcon,
	rainmaker: CloudRainIcon,
	team_player: HandshakeIcon,
	bug_hunter: BugIcon,
	shaped_wandit: ShapesIcon,
	steady_4: MetronomeIcon,
	seasoned_12: CalendarCheckIcon,
	half_year: FireIcon,
	spend_spark: SparkleIcon,
	spend_apprentice: StudentIcon,
	spend_builder: HammerIcon,
	spend_artisan: PaintBrushIcon,
	spend_master: MedalIcon,
	spend_legend: CrownIcon,
	backer: HeartIcon,
	early_adopter: BirdIcon,
} satisfies Record<TrophyId, Icon>;
