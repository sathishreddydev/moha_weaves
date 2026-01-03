-- Create contact_messages table
CREATE TABLE IF NOT EXISTS "contact_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20),
	"subject" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS "idx_contact_messages_email" ON "contact_messages" ("email");

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS "idx_contact_messages_status" ON "contact_messages" ("status");

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS "idx_contact_messages_created_at" ON "contact_messages" ("created_at" DESC);
