ALTER TYPE "public"."order_status" ADD VALUE 'exchange_processing' BEFORE 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'exchange_shipped' BEFORE 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'exchange_delivered' BEFORE 'cancelled';--> statement-breakpoint
DROP TYPE "public"."exchange_status";