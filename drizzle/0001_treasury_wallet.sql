CREATE TABLE "treasury_wallet" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"pubkey" text NOT NULL,
	"salt" text NOT NULL,
	"iv" text NOT NULL,
	"tag" text NOT NULL,
	"ciphertext" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
