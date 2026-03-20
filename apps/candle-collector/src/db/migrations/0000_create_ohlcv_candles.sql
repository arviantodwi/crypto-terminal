CREATE TABLE "ohlcv_candles" (
	"instrument" varchar(100) NOT NULL,
	"open_time" bigint NOT NULL,
	"timeframe" varchar(10) NOT NULL,
	"open" double precision NOT NULL,
	"high" double precision NOT NULL,
	"low" double precision NOT NULL,
	"close" double precision NOT NULL,
	"volume" double precision NOT NULL,
	"quote_volume" double precision NOT NULL,
	"num_trades" bigint NOT NULL,
	CONSTRAINT "ohlcv_candles_instrument_open_time_timeframe_pk" PRIMARY KEY("instrument","open_time","timeframe")
);
