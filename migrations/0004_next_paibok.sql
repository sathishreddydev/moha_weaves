ALTER TYPE "public"."payment_method" ADD VALUE 'razorpay';--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "razorpay_payment_id" text;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD COLUMN "user_name" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "valid_from" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "valid_until" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_user_name_users_name_fk" FOREIGN KEY ("user_name") REFERENCES "public"."users"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" DROP COLUMN "start_date";--> statement-breakpoint
ALTER TABLE "sales" DROP COLUMN "end_date";