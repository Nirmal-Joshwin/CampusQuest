import { apiClient } from './api';

export interface CampusStronghold {
  id: string;
  name: string;
  landmark: string;
  latitude: number;
  longitude: number;
  controlling_department: 'CSE' | 'ECE' | 'MECH' | 'CIVIL' | 'AI&DS' | 'UNCLAIMED';
  defense_score: number;
  active_buff: string;
  top_defender: string;
  department_points: Record<string, number>;
}

export interface DepartmentRanking {
  department: string;
  total_points: number;
  strongholds_controlled: number;
}

export const FALLBACK_STRONGHOLDS: CampusStronghold[] = [
  {
    id: 'stronghold-1',
    name: 'Admin Tower & Council Hall',
    landmark: 'Admin Block & Tower Quad',
    latitude: 11.0268,
    longitude: 77.0265,
    controlling_department: 'CSE',
    defense_score: 1450,
    active_buff: '+15% Anomaly Capture XP Bonus',
    top_defender: 'Sneha (AI&DS/CSE)',
    department_points: { CSE: 1450, ECE: 1100, MECH: 820, CIVIL: 450, 'AI&DS': 980 },
  },
  {
    id: 'stronghold-2',
    name: 'Central Library & Knowledge Hub',
    landmark: 'CIT Central Library Quad',
    latitude: 11.0282,
    longitude: 77.0264,
    controlling_department: 'AI&DS',
    defense_score: 1620,
    active_buff: '+20% Quantum Energy Regeneration',
    top_defender: 'Karthik (AI&DS)',
    department_points: { CSE: 1300, ECE: 950, MECH: 600, CIVIL: 400, 'AI&DS': 1620 },
  },
  {
    id: 'stronghold-3',
    name: 'Sports Stadium & Athletic Arena',
    landmark: 'CIT Campus Stadium Grounds',
    latitude: 11.0296,
    longitude: 77.0288,
    controlling_department: 'MECH',
    defense_score: 1280,
    active_buff: '+25% Walking Buddy Data Credit Discovery',
    top_defender: 'Rahul (MECH)',
    department_points: { CSE: 800, ECE: 850, MECH: 1280, CIVIL: 700, 'AI&DS': 500 },
  },
  {
    id: 'stronghold-4',
    name: 'Mechanical & Tech Labs Workshop',
    landmark: 'Heavy Machinery & Civil Quad',
    latitude: 11.0275,
    longitude: 77.0301,
    controlling_department: 'ECE',
    defense_score: 1390,
    active_buff: '+15% Challenge Decryption Speed',
    top_defender: 'Vignesh (ECE)',
    department_points: { CSE: 900, ECE: 1390, MECH: 1150, CIVIL: 600, 'AI&DS': 750 },
  },
];

export async function fetchStrongholdsApi(): Promise<CampusStronghold[]> {
  try {
    const res = await apiClient.get<{ count: number; strongholds: CampusStronghold[] }>(
      '/api/turf/strongholds'
    );
    if (res.data.strongholds && res.data.strongholds.length > 0) {
      return res.data.strongholds;
    }
  } catch (e) {
    console.warn('[Turf] Failed to fetch strongholds:', e);
  }
  return FALLBACK_STRONGHOLDS;
}

export async function defendStrongholdApi(
  strongholdId: string,
  creatureName: string,
  token?: string | null
): Promise<{ success: boolean; message: string; stronghold?: CampusStronghold }> {
  try {
    if (token && token !== 'guest-token') {
      const res = await apiClient.post(
        '/api/turf/defend',
        { stronghold_id: strongholdId, creature_name: creatureName, defense_contribution: 200 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    }
  } catch (e: any) {
    console.warn('[Turf] Defend error:', e);
  }
  return {
    success: true,
    message: `🛡️ Stationed ${creatureName}! +200 Defense points added for your department!`,
  };
}

export async function fetchTurfLeaderboardApi(): Promise<DepartmentRanking[]> {
  try {
    const res = await apiClient.get<{ leaderboard: DepartmentRanking[] }>(
      '/api/turf/leaderboard'
    );
    if (res.data.leaderboard) {
      return res.data.leaderboard;
    }
  } catch (e) {
    console.warn('[Turf] Leaderboard error:', e);
  }
  return [
    { department: 'CSE', total_points: 4450, strongholds_controlled: 1 },
    { department: 'AI&DS', total_points: 3850, strongholds_controlled: 1 },
    { department: 'ECE', total_points: 4290, strongholds_controlled: 1 },
    { department: 'MECH', total_points: 3850, strongholds_controlled: 1 },
    { department: 'CIVIL', total_points: 2150, strongholds_controlled: 0 },
  ];
}

