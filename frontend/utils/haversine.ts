/**
 * Haversine formula distance calculation and Rarity System Utilities
 */

export type RarityTier = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface SpawnPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  rarity?: RarityTier;
}

export interface SpawnWithDistance extends SpawnPoint {
  distanceMeters: number;
  isWithinCatchRange: boolean;
}

/**
 * Calculates the great-circle distance between two GPS points using the Haversine formula.
 * Returns distance in meters.
 */
export function calculateHaversineDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const EARTH_RADIUS_METERS = 6371000; // Earth's mean radius in meters

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const lat1Rad = toRadians(coord1.latitude);
  const lat2Rad = toRadians(coord2.latitude);
  const deltaLat = toRadians(coord2.latitude - coord1.latitude);
  const deltaLng = toRadians(coord2.longitude - coord1.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates distances from user location to all spawn points and sorts ascending.
 */
export function calculateDistancesToSpawns(
  userLocation: Coordinates,
  spawns: SpawnPoint[],
  proximityThresholdMeters: number = 15
): SpawnWithDistance[] {
  return spawns
    .map((spawn) => {
      const distance = calculateHaversineDistance(userLocation, {
        latitude: spawn.latitude,
        longitude: spawn.longitude,
      });

      return {
        ...spawn,
        rarity: spawn.rarity || 'COMMON',
        distanceMeters: distance,
        isWithinCatchRange: distance <= proximityThresholdMeters,
      };
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

/**
 * Formats a distance in meters to a human-readable string (e.g. "8m" or "1.2km").
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Rarity Visual Theme Data
 */
export interface RarityConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  icon: string;
  xpReward: number;
}

export const RARITY_THEMES: Record<RarityTier, RarityConfig> = {
  COMMON: {
    label: 'Common',
    color: '#94A3B8',
    bgColor: '#1E293B',
    borderColor: '#64748B',
    glowColor: 'rgba(148, 163, 184, 0.4)',
    icon: '⚪',
    xpReward: 100,
  },
  RARE: {
    label: 'Rare',
    color: '#38BDF8',
    bgColor: '#082F49',
    borderColor: '#0284C7',
    glowColor: 'rgba(56, 189, 248, 0.6)',
    icon: '🔵',
    xpReward: 250,
  },
  EPIC: {
    label: 'Epic',
    color: '#C084FC',
    bgColor: '#3B0764',
    borderColor: '#9333EA',
    glowColor: 'rgba(192, 132, 252, 0.7)',
    icon: '🟣',
    xpReward: 600,
  },
  LEGENDARY: {
    label: 'Legendary',
    color: '#FBBF24',
    bgColor: '#451A03',
    borderColor: '#D97706',
    glowColor: 'rgba(251, 191, 36, 0.85)',
    icon: '🟡',
    xpReward: 1500,
  },
};

export function getRarityConfig(rarity?: RarityTier): RarityConfig {
  return RARITY_THEMES[rarity || 'COMMON'];
}

export function getCreatureEmoji(name: string): string {
  const map: Record<string, string> = {
    'CIT CyberDragon': '🐉',
    'QuantumSprite': '✨',
    'RoboGolem': '🤖',
    'CircuitPhoenix': '🔥',
    'CodePhantom': '👻',
    'NeuralFox': '🦊',
    'ByteFalcon': '🦅',
    'SiliconTitan': '⚡',
    'CampusOwl': '🦉',
    'AeroMech': '🚀',
  };
  return map[name] || '👾';
}
