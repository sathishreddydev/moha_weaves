-- Add addressLine1 and state to user_addresses
ALTER TABLE "user_addresses" ADD COLUMN IF NOT EXISTS "address_line1" text NOT NULL DEFAULT '';
ALTER TABLE "user_addresses" ADD COLUMN IF NOT EXISTS "state" text NOT NULL DEFAULT '';
