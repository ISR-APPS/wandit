# Gridwatch

This file describes the Gridwatch starter for the app builder.
The starter uses the base Supabase login and profile routes.

## Pages

- `/app` shows overview.
- `/app/workbench` shows meters with search and expandable rows.
- `/app/activity` shows site events with search and expandable rows.
- `/app/profile` shows the signed-in profile.

The workspace reads sample records from `src/features/dashboard/lib/workspace.ts`.
Replace these records with Supabase queries when you add the workspace tables.

Edit the workspace menu in `src/features/app-shell/components/app-shell.tsx`.
