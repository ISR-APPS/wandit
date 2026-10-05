---
name: "dashboard"
description: "Build SaaS workspaces, admin tools, CRM, analytics, and internal apps with the local dashboard kit. Explicit marketing pages use design worlds."
---

<!-- The skill exporter copies this guide into generated projects.
The coding agent uses it to compose workspaces from the local template source. -->
# Dashboard workspaces

Use this skill for SaaS workspaces, admin tools, CRM, analytics, and internal workflows.
Select the structure from the actual user task. The words "SaaS" and "product" do not imply a landing page.
An explicit marketing or landing-page request uses a design world instead.
If the user requests both, build separate marketing and workspace routes.

## Select the composition

| Main task | Composition | First useful screen |
| --- | --- | --- |
| Understand results and investigate changes | `analytics` | Relevant measurements, trends, and a path to the underlying records |
| Process customers, orders, tickets, or other records | `operations` | A usable table or list, filters, selection, and record details |
| Create, edit, review, or operate something | `workbench` | The main work surface with context, tools, or a preview beside it |

Choose the dominant task. Do not put a KPI grid above every workflow.
Build the main functional workspace first. Add secondary panels only when they support that task.
Keep charts out of record workflows that do not need them.
Do not invent business measurements, growth percentages, customers, activity, or financial values.
For missing records, show an empty state with a working next action.
For requested demo data, identify it as sample data.
Connect search, filters, pagination, navigation, and action buttons to real behavior.
Do not add decorative controls that do nothing.

For a new workspace-only app, make `/` lead to the workspace through the existing authentication flow.
Keep the session guard, login path, server validation, and Supabase RLS.
Do not insert a marketing page before the workspace unless the user requests one.
For an existing app, preserve routes and layout unless the requested change requires modification.
A selected design world can supply tone, fonts, and tokens. Its landing-page sections do not replace workspace structure.

## Read only the selected source

These links resolve from the generated skill directory to files in the project:

- [Dashboard shell](../../../src/shared/ui/dashboard-shell.tsx): read for navigation, mobile behavior, and shell props.
- [Dashboard content](../../../src/shared/ui/dashboard-content.tsx): read for the selected composition and page header.
- [Design tokens](../../../src/styles/tokens.css): read before applying the chosen palette.
- [Protected app route](../../../src/routes/app.tsx): read before connecting the workspace to authentication and data.

Read individual files in `src/shared/ui/` only when the selected workflow needs those controls.
Use the local source directly. Do not load every skill, component, or palette into the prompt.
Do not read or copy a premium admin-template source tree. This kit contains original template code.
No cloud registry is required.

## Keep project choices fixed

Apply explicit brief choices first, then existing project choices, then the harness defaults.
The harness fields are `variant`, `density`, `contentWidth`, `palette`, and `radius`.
Save the final shell fields as a module-level object literal in the workspace component.
Save color, radius, and font values in `src/styles/tokens.css`.
Keep the selected palette name beside those token values.
Never recalculate these choices during rendering or on a later turn.
Do not add a theme picker unless the user requests one.

| Field | Values | Selection rule |
| --- | --- | --- |
| `variant` | `sidebar`, `inset`, `rail` | Sidebar for many labeled destinations. Inset for a distinct content surface. Rail for a few recognizable destinations. |
| `density` | `compact`, `comfortable` | Compact for frequent record operations. Comfortable for reading, review, or onboarding. |
| `contentWidth` | `full`, `centered` | Full for tables and work surfaces. Centered for forms or a limited amount of content. |
| `palette` | `graphite`, `ocean`, `forest`, `violet`, `amber` | Use the supplied default unless the brief or existing brand selects another palette. |
| `radius` | `0.375rem`, `0.625rem`, `0.875rem` | Use the supplied default consistently across controls and panels. |

Density controls spacing, not font size or the amount of information.
Keep action labels visible and preserve keyboard focus indicators.
Use logical spacing and placement so Arabic retains the same information order.

## Token recipes

Each row supplies the six core tokens in the harness defaults. All primary colors use a white foreground.

| Palette | `--background` | `--foreground` | `--card` | `--muted-foreground` | `--primary` | `--primary-foreground` |
| --- | --- | --- | --- | --- | --- | --- |
| `graphite` | `#fafafa` | `#18181b` | `#ffffff` | `#52525b` | `#27272a` | `#ffffff` |
| `ocean` | `#f8fafc` | `#0f172a` | `#ffffff` | `#475569` | `#1d4ed8` | `#ffffff` |
| `forest` | `#f7faf8` | `#14251c` | `#ffffff` | `#4b6355` | `#166534` | `#ffffff` |
| `violet` | `#faf9ff` | `#24153a` | `#ffffff` | `#645575` | `#6d28d9` | `#ffffff` |
| `amber` | `#fffbeb` | `#292016` | `#ffffff` | `#715c44` | `#92400e` | `#ffffff` |

Set `--card-foreground` and `--popover-foreground` to `--foreground`.
Set `--popover` to `--card`, and `--ring` to `--primary`.
Use a light neutral for `--muted`, `--secondary`, and `--accent`.
Pair each surface with its foreground token. Do not put white text on a light accent surface.
For `ocean`, this extension gives a dark navigation surface and distinct chart series:

```css
/* Static ocean palette extension. The shell reads these semantic tokens. */
:root {
  --muted: #f1f5f9;
  --secondary: #f1f5f9;
  --secondary-foreground: #0f172a;
  --accent: #e2e8f0;
  --accent-foreground: #0f172a;
  --border: #cbd5e1;
  --input: #cbd5e1;
  --sidebar: #0f172a;
  --sidebar-foreground: #f8fafc;
  --sidebar-accent: #1e293b;
  --sidebar-accent-foreground: #f8fafc;
  --sidebar-border: #334155;
  --sidebar-ring: #93c5fd;
  --chart-1: #1d4ed8;
  --chart-2: #0f766e;
  --chart-3: #6d28d9;
  --radius: 0.625rem;
}
```

For other palettes, use the chosen foreground as `--sidebar` and the chosen background as `--sidebar-foreground`.
Set sidebar accent, border, and focus colors for that surface. Keep chart series distinct from status colors.
Use chart labels and units. Do not communicate meaning through color alone.
Keep one static light or dark treatment unless the user requests both.
If dark mode already exists, update its foreground pairs too.
Keep the existing Satoshi/Clash Display fonts and Tajawal/Changa Arabic fonts unless the brief specifies another pairing.
If you change fonts, update both the token definitions and the root head font links.

## Integration example

Place this component in the workspace feature. It accepts real workflow content and translated navigation labels.
It adds no metrics. Add the navigation labels to the configured language dictionaries with matching keys.
Replace its literal shell values with the final project choices.
Keep navigation links limited to routes that exist.

```tsx
// Composes protected workflow content inside the shared dashboard shell.
// The workspace feature supplies its title and functional panels after the route session check.
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { DashboardBody, DashboardPageHeader } from "~/shared/ui/dashboard-content";
import { DashboardNavItem, DashboardShell } from "~/shared/ui/dashboard-shell";
import { InfoIcon } from "~/shared/ui/icons";
import { useT } from "~/shared/i18n";

const dashboardDesign = {
  variant: "inset",
  density: "comfortable",
  contentWidth: "full",
} as const;

type WorkspaceFrameProps = {
  /** Translated title for the current workflow. */
  title: string;
  /** Task selection or context for this workbench. */
  primary: ReactNode;
  /** The active work surface uses the wider workbench column. */
  secondary?: ReactNode;
  /** The workspace feature supplies these strings through useT(). */
  navigationLabels: {
    navigation: string;
    open: string;
    close: string;
    skipToContent: string;
  };
};

/** The route guards authentication. The workspace feature owns workflow state. */
export function WorkspaceFrame({ title, primary, secondary, navigationLabels }: WorkspaceFrameProps) {
  const { t } = useT();
  return (
    <DashboardShell
      {...dashboardDesign}
      brand={<Link to="/app">{t("common.appName")}</Link>}
      navigationLabel={navigationLabels.navigation}
      openNavigationLabel={navigationLabels.open}
      closeNavigationLabel={navigationLabels.close}
      skipToContentLabel={navigationLabels.skipToContent}
      navigation={(closeNavigation) => (
        <DashboardNavItem active>
          <Link to="/app" onClick={closeNavigation}>
            <InfoIcon />
            <span>{title}</span>
          </Link>
        </DashboardNavItem>
      )}
    >
      <DashboardPageHeader title={title} />
      <DashboardBody layout="workbench" primary={primary} secondary={secondary} />
    </DashboardShell>
  );
}
```

For analytics, use `layout="analytics"` and real `DashboardMetric` children in the optional `metrics` prop.
For operations, use `layout="operations"` with the records view as `primary` and selected-record details as `secondary`.
Keep loading, empty, error, and populated states within the workflow panels.
Before completion, run the template typecheck and lint commands.
Exercise navigation, mobile open/close, keyboard focus, RTL, and the main workflow action.
