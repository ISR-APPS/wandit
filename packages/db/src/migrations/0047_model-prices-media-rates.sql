-- Measured-cost billing: model_prices grows the per-second video and
-- transcription rates plus the size/mode/resolution variant list. No
-- backfill: the seed map is rebuilt in memory on boot and the next gateway
-- refresh fills the columns; until then rows read NULL and callers reserve
-- at the registry floor.
ALTER TABLE "model_prices" ADD COLUMN "video_usd_micros_per_second" integer;--> statement-breakpoint
ALTER TABLE "model_prices" ADD COLUMN "transcription_usd_micros_per_second" integer;--> statement-breakpoint
ALTER TABLE "model_prices" ADD COLUMN "variant_pricing" jsonb;
