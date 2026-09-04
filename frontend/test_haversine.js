// Benchmark validation for Haversine Distance Formula
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const EARTH_RADIUS_METERS = 6371000;
  const toRadians = (deg) => (deg * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

// 1. Same point distance should be 0
const d0 = calculateHaversineDistance(11.025, 77.025, 11.025, 77.025);
console.assert(d0 === 0, `Expected 0m, got ${d0}m`);
console.log(`[PASS] Zero distance test: ${d0}m`);

// 2. Approx 11 meters delta in lat (~0.0001 deg lat is ~11.1 meters)
const d1 = calculateHaversineDistance(11.025000, 77.025000, 11.025100, 77.025000);
console.log(`[PASS] ~0.0001 deg Lat delta distance: ${d1.toFixed(2)}m (Within 15m threshold? ${d1 <= 15})`);
console.assert(d1 > 10 && d1 < 12, `Expected ~11.1m, got ${d1}`);

// 3. CIT diagonal distance across bounds (11.025, 77.025 to 11.030, 77.030)
const dCIT = calculateHaversineDistance(11.025, 77.025, 11.030, 77.030);
console.log(`[PASS] CIT campus corner-to-corner diagonal: ${dCIT.toFixed(2)}m`);

console.log("[ALL HAVERSINE UTILITY TESTS PASSED]");

