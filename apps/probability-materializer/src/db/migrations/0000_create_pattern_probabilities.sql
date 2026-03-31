CREATE TABLE "pattern_probabilities" (
	"instrument" varchar(100) NOT NULL,
	"timeframe" varchar(10) NOT NULL,
	"c1_label" varchar(20) NOT NULL,
	"c2_label" varchar(20) NOT NULL,
	"c3_label" varchar(20) NOT NULL,
	"occurrences" integer NOT NULL,
	"up_count" integer NOT NULL,
	"down_count" integer NOT NULL,
	"up_probability" double precision NOT NULL,
	"down_probability" double precision NOT NULL,
	"computed_at" timestamp NOT NULL,
	CONSTRAINT "pattern_probabilities_instrument_timeframe_c1_label_c2_label_c3_label_pk" PRIMARY KEY("instrument","timeframe","c1_label","c2_label","c3_label")
);
