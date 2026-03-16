"""
Data models for Binance USDS Futures continuous kline messages
and the outbound payload sent to frontend WebSocket clients.
"""

import dataclasses
from dataclasses import dataclass


@dataclass
class KlineData:
    open_time: int
    close_time: int
    interval: str
    open: str
    high: str
    low: str
    close: str
    volume: str
    num_trades: int
    is_closed: bool


@dataclass
class KlineMessage:
    type: str
    event_time: int
    pair: str
    contract_type: str
    kline: KlineData


def parse_kline_message(raw: dict) -> KlineMessage:
    k = raw["k"]
    return KlineMessage(
        type="kline",
        event_time=raw["E"],
        pair=raw["ps"],
        contract_type=raw["ct"],
        kline=KlineData(
            open_time=k["t"],
            close_time=k["T"],
            interval=k["i"],
            open=k["o"],
            high=k["h"],
            low=k["l"],
            close=k["c"],
            volume=k["v"],
            num_trades=k["n"],
            is_closed=k["x"],
        ),
    )


def kline_message_to_dict(msg: KlineMessage) -> dict:
    return dataclasses.asdict(msg)
