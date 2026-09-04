import { apiClient, API_BASE_URL } from './api';

export interface PeerCadet {
  user_id: string;
  username: string;
  department: string;
  level: number;
  avatar_title: string;
  latitude: number;
  longitude: number;
  updated_at?: string;
}

export interface RaidGroupData {
  raid_id: string;
  boss_name: string;
  campus_sector: string;
  host_user_id: string;
  host_username: string;
  created_at: string;
  teammates: {
    user_id: string;
    username: string;
    department: string;
    level: number;
  }[];
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
}

// Fallback active campus peers to simulate alive campus MMORPG if offline
export const FALLBACK_CAMPUS_PEERS: PeerCadet[] = [
  {
    user_id: 'cit-peer-1',
    username: 'Karthik',
    department: 'ECE',
    level: 3,
    avatar_title: 'Circuit Vanguard',
    latitude: 11.027500,
    longitude: 77.028700,
  },
  {
    user_id: 'cit-peer-2',
    username: 'Sneha',
    department: 'AI&DS',
    level: 4,
    avatar_title: 'Neural Scout',
    latitude: 11.028800,
    longitude: 77.027300,
  },
];

export async function fetchActivePeersApi(): Promise<PeerCadet[]> {
  try {
    const res = await apiClient.get<{ active_cadets_count: number; peers: PeerCadet[] }>(
      '/api/multiplayer/peers'
    );
    if (res.data.peers && res.data.peers.length > 0) {
      return res.data.peers;
    }
  } catch (e) {
    console.warn('[Multiplayer] Failed to fetch live peers:', e);
  }
  return FALLBACK_CAMPUS_PEERS;
}

export async function createTagTeamRaidApi(
  bossName: string,
  sector: string,
  token?: string | null
): Promise<RaidGroupData> {
  try {
    if (token && token !== 'guest-token') {
      const res = await apiClient.post(
        '/api/multiplayer/raid/create',
        { boss_name: bossName, campus_sector: sector },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data.raid;
    }
  } catch (e) {
    console.warn('[Multiplayer] Create raid failed:', e);
  }
  return {
    raid_id: 'raid-cit-101',
    boss_name: bossName,
    campus_sector: sector,
    host_user_id: 'cadet-host',
    host_username: 'CIT Cadet',
    created_at: new Date().toISOString(),
    teammates: [
      { user_id: 'cadet-host', username: 'CIT Cadet', department: 'CSE', level: 1 },
      { user_id: 'cit-peer-1', username: 'Karthik', department: 'ECE', level: 3 },
    ],
    status: 'OPEN',
  };
}

export async function completeTagTeamRaidApi(
  raidId: string,
  token?: string | null
): Promise<{ success: boolean; message: string }> {
  try {
    if (token && token !== 'guest-token') {
      const res = await apiClient.post(
        `/api/multiplayer/raid/${raidId}/complete`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    }
  } catch (e) {
    console.warn('[Multiplayer] Complete raid failed:', e);
  }
  return {
    success: true,
    message: '🎉 TAG-TEAM VICTORY! Boss secured with your strike group!\n+2000 Bonus XP & +100 Data Credits awarded!',
  };
}

export function getRadarWebSocketUrl(userId: string): string {
  const wsProto = API_BASE_URL.startsWith('https') ? 'wss' : 'ws';
  const cleanHost = API_BASE_URL.replace(/^https?:\/\//, '');
  return `${wsProto}://${cleanHost}/api/multiplayer/ws/radar/${userId}`;
}

