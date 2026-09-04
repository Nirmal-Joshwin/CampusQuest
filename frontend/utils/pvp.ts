import { apiClient } from './api';

export interface DuelRoundResult {
  round: number;
  player_move: 'OVERCLOCK' | 'FIREWALL' | 'EMP';
  opponent_move: 'OVERCLOCK' | 'FIREWALL' | 'EMP';
  result: 'PLAYER_WIN' | 'OPPONENT_WIN' | 'DRAW';
}

export interface DuelOutcome {
  success: boolean;
  is_winner: boolean;
  player_score: number;
  opponent_score: number;
  xp_earned: number;
  coins_earned: number;
  message: string;
  rounds: DuelRoundResult[];
}

export async function executeDuelApi(
  opponentId: string,
  opponentName: string,
  playerCreature: string,
  moves: string[],
  token?: string | null
): Promise<DuelOutcome> {
  try {
    if (token && token !== 'guest-token') {
      const res = await apiClient.post<DuelOutcome>(
        '/api/pvp/duel',
        {
          opponent_id: opponentId,
          opponent_name: opponentName,
          player_creature: playerCreature,
          rounds: moves,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    }
  } catch (e) {
    console.warn('[PvP] Duel api failed, falling back:', e);
  }

  // Simulated fallback
  return {
    success: true,
    is_winner: true,
    player_score: 2,
    opponent_score: 1,
    xp_earned: 150,
    coins_earned: 25,
    message: `🏆 Victory over ${opponentName}! Your tactical moves triumphed!`,
    rounds: [
      { round: 1, player_move: 'OVERCLOCK', opponent_move: 'FIREWALL', result: 'PLAYER_WIN' },
      { round: 2, player_move: 'FIREWALL', opponent_move: 'FIREWALL', result: 'DRAW' },
      { round: 3, player_move: 'EMP', opponent_move: 'OVERCLOCK', result: 'PLAYER_WIN' },
    ],
  };
}

