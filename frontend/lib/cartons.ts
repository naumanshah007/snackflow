// Carton-first display helpers. The business sells in cartons; stock is stored
// internally in packets. Convert with the SKU pack_quantity everywhere a user
// enters, views, or reports stock.
//
//   cartons       = floor(packets / pack_quantity)
//   loose_packets = packets % pack_quantity

export function packQty(value: number | string | null | undefined): number {
  const pack = Number(value);
  return Number.isFinite(pack) && pack > 0 ? pack : 1;
}

export function splitCartons(packets: number | string | null | undefined, pack: number | string | null | undefined) {
  const p = packQty(pack);
  const total = Math.trunc(Number(packets) || 0);
  const sign = total < 0 ? -1 : 1;
  const mag = Math.abs(total);
  return { cartons: sign * Math.floor(mag / p), loose: sign * (mag % p) };
}

// "12 cartons + 5 pkts" style label.
export function cartonLabel(packets: number | string | null | undefined, pack: number | string | null | undefined): string {
  const { cartons, loose } = splitCartons(packets, pack);
  if (cartons && loose) return `${cartons} cartons + ${loose} pkts`;
  if (cartons) return `${cartons} ${cartons === 1 ? "carton" : "cartons"}`;
  return `${loose} pkts`;
}

export function toPackets(cartons: number | string | null | undefined, loose: number | string | null | undefined, pack: number | string | null | undefined): number {
  return (Number(cartons) || 0) * packQty(pack) + (Number(loose) || 0);
}

export function perCarton(perPacket: number | string | null | undefined, pack: number | string | null | undefined): number {
  return Math.round((Number(perPacket) || 0) * packQty(pack) * 100) / 100;
}

export function perPacket(perCartonRate: number | string | null | undefined, pack: number | string | null | undefined): number {
  return Math.round(((Number(perCartonRate) || 0) / packQty(pack)) * 10000) / 10000;
}
