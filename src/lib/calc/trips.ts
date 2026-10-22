/** A trip's distance. A backwards reading counts as zero rather than a negative ride. */
export function tripDistance(trip: { startOdometer: number; endOdometer: number }): number {
  return Math.max(0, trip.endOdometer - trip.startOdometer);
}

export function tripTotals(trips: { startOdometer: number; endOdometer: number }[]): { count: number; distance: number } {
  return { count: trips.length, distance: trips.reduce((sum, t) => sum + tripDistance(t), 0) };
}
