"""Carton/packet conversion helpers.

The business sells and counts in cartons. Stock is stored internally in
packets for accuracy, so every user-facing surface converts using the SKU
``pack_quantity``:

    cartons       = quantity_packets // pack_quantity
    loose_packets = quantity_packets %  pack_quantity
"""

from __future__ import annotations


def split_cartons(quantity_packets: int, pack_quantity: int | None) -> tuple[int, int]:
    """Return ``(cartons, loose_packets)`` for a packet quantity."""
    pack = pack_quantity or 1
    if pack <= 0:
        pack = 1
    sign = -1 if quantity_packets < 0 else 1
    magnitude = abs(int(quantity_packets))
    cartons = magnitude // pack
    loose = magnitude % pack
    return sign * cartons, sign * loose


def carton_label(quantity_packets: int, pack_quantity: int | None) -> str:
    """Human readable carton string e.g. ``"12 cartons + 5 packets"``."""
    cartons, loose = split_cartons(quantity_packets, pack_quantity)
    if cartons and loose:
        return f"{cartons} cartons + {loose} packets"
    if cartons:
        return f"{cartons} cartons"
    return f"{loose} packets"


def carton_fields(quantity_packets: int, pack_quantity: int | None) -> dict[str, int | str]:
    """Standard carton breakdown dict reused across API responses."""
    cartons, loose = split_cartons(quantity_packets, pack_quantity)
    return {
        "pack_quantity": pack_quantity or 1,
        "cartons": cartons,
        "loose_packets": loose,
        "total_packets": quantity_packets,
        "carton_label": carton_label(quantity_packets, pack_quantity),
    }


def to_packets(cartons: int | None, loose_packets: int | None, pack_quantity: int | None) -> int:
    """Convert a cartons + loose-packets entry into total packets."""
    pack = pack_quantity or 1
    return int(cartons or 0) * pack + int(loose_packets or 0)
