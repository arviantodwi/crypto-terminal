CREATE TABLE "instruments" (
	"symbol" varchar(50) PRIMARY KEY NOT NULL,
	"pair" varchar(50) NOT NULL,
	"contract_type" varchar(50) NOT NULL,
	"delivery_date" bigint NOT NULL,
	"status" varchar(50) NOT NULL,
	"last_synced_at" timestamp NOT NULL
);
