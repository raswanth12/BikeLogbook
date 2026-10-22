export function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

export function totalFrom(litres: number, pricePerLitre: number): number {
  return round(litres * pricePerLitre, 2);
}

/** Price keeps three decimals so litres x price lands back on the total the pump showed. */
export function priceFrom(total: number, litres: number): number {
  return litres > 0 ? round(total / litres, 3) : 0;
}
