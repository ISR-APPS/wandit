CREATE TYPE "public"."desktop_engine" AS ENUM('tauri', 'electron');--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "desktop_engine" "desktop_engine";