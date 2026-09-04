import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { executeDuelApi, DuelOutcome } from '../utils/pvp';
import { liquidGlass, GLASS_COLORS } from '../styles/liquidGlass';
import { triggerHapticTap, triggerHapticSuccess, triggerHapticImpact } from '../utils/haptics';
import { playTapSound, playSwooshSound, playBattleSound, playCatchSound } from '../utils/sound';

interface DuelModalProps {
  visible: boolean;
  onClose: () => void;
  opponentId: string;
  opponentName: string;
  opponentDepartment: string;
  playerCreature?: string;
  token?: string | null;
  onDuelCompleted?: (outcome: DuelOutcome) => void;
}

export default function DuelModal({
  visible,
  onClose,
  opponentId,
  opponentName,
  opponentDepartment,
  playerCreature = 'ByteFalcon',
  token,
  onDuelCompleted,
}: DuelModalProps) {
  const [selectedMoves, setSelectedMoves] = useState<('OVERCLOCK' | 'FIREWALL' | 'EMP')[]>([]);
  const [battling, setBattling] = useState<boolean>(false);
  const [outcome, setOutcome] = useState<DuelOutcome | null>(null);

  const handleSelectMove = (move: 'OVERCLOCK' | 'FIREWALL' | 'EMP') => {
    if (selectedMoves.length < 3) {
      triggerHapticTap();
      playTapSound();
      setSelectedMoves([...selectedMoves, move]);
    }
  };

  const handleResetMoves = () => {
    triggerHapticTap();
    setSelectedMoves([]);
    setOutcome(null);
  };

  const handleExecuteBattle = async () => {
    if (selectedMoves.length < 3) return;
    setBattling(true);
    triggerHapticImpact('heavy');
    playBattleSound();
    try {
      const res = await executeDuelApi(opponentId, opponentName, playerCreature, selectedMoves, token);
      setOutcome(res);
      if (res.is_winner) {
        triggerHapticSuccess();
        playCatchSound();
      } else {
        triggerHapticImpact('medium');
      }
      if (onDuelCompleted) {
        onDuelCompleted(res);
      }
    } catch (e) {
      console.warn('Duel error:', e);
    } finally {
      setBattling(false);
    }
  };

  const handleClose = () => {
    triggerHapticTap();
    playSwooshSound();
    handleResetMoves();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.clayCard}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>⚔️ TACTICAL CADET DUEL</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Versus Banner */}
          <View style={styles.vsRow}>
            <View style={styles.clayFighterBox}>
              <Text style={styles.fighterEmoji}>🦅</Text>
              <Text style={styles.fighterName}>{playerCreature}</Text>
              <Text style={styles.fighterSub}>You</Text>
            </View>

            <View style={styles.vsBadge}>
              <Text style={styles.vsText}>VS</Text>
            </View>

            <View style={styles.clayFighterBox}>
              <Text style={styles.fighterEmoji}>🤖</Text>
              <Text style={styles.fighterName}>{opponentName}</Text>
              <Text style={styles.fighterSub}>{opponentDepartment}</Text>
            </View>
          </View>

          {!outcome ? (
            <>
              {/* Instructions */}
              <Text style={styles.sectionSubtitle}>
                Select 3 tactical moves to counter your classmate:
              </Text>

              {/* Move Selection Slot Pills */}
              <View style={styles.slotRow}>
                {[0, 1, 2].map((idx) => {
                  const move = selectedMoves[idx];
                  return (
                    <View key={idx} style={[styles.slotPill, move && styles.slotPillFilled]}>
                      <Text style={styles.slotPillText}>
                        {move ? `R${idx + 1}: ${move}` : `Round ${idx + 1}`}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Tactical Buttons */}
              <View style={styles.movesGrid}>
                <TouchableOpacity
                  style={[styles.clayMoveButton, styles.overclockButton]}
                  onPress={() => handleSelectMove('OVERCLOCK')}
                  disabled={selectedMoves.length >= 3}
                >
                  <Text style={styles.moveEmoji}>⚡</Text>
                  <Text style={styles.moveName}>Overclock Pulse</Text>
                  <Text style={styles.moveCounter}>Beats Firewall</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.clayMoveButton, styles.firewallButton]}
                  onPress={() => handleSelectMove('FIREWALL')}
                  disabled={selectedMoves.length >= 3}
                >
                  <Text style={styles.moveEmoji}>🛡️</Text>
                  <Text style={styles.moveName}>Quantum Firewall</Text>
                  <Text style={styles.moveCounter}>Beats EMP</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.clayMoveButton, styles.empButton]}
                  onPress={() => handleSelectMove('EMP')}
                  disabled={selectedMoves.length >= 3}
                >
                  <Text style={styles.moveEmoji}>💥</Text>
                  <Text style={styles.moveName}>EMP Disruptor</Text>
                  <Text style={styles.moveCounter}>Beats Overclock</Text>
                </TouchableOpacity>
              </View>

              {/* Actions */}
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.resetButton} onPress={handleResetMoves}>
                  <Text style={styles.resetText}>Clear</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.launchButton,
                    selectedMoves.length < 3 && styles.launchButtonDisabled,
                  ]}
                  disabled={selectedMoves.length < 3 || battling}
                  onPress={handleExecuteBattle}
                >
                  {battling ? (
                    <ActivityIndicator size="small" color="#0F172A" />
                  ) : (
                    <Text style={styles.launchText}>🚀 CLASH MOVES!</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            /* Outcome View */
            <View style={styles.outcomeContainer}>
              <Text style={styles.outcomeTitle}>{outcome.message}</Text>
              <Text style={styles.scoreText}>
                Final Score: {outcome.player_score} - {outcome.opponent_score}
              </Text>

              {/* Rounds Breakdown */}
              <View style={styles.roundsList}>
                {outcome.rounds.map((r) => (
                  <View key={r.round} style={styles.roundCard}>
                    <Text style={styles.roundLabel}>Round {r.round}:</Text>
                    <Text style={styles.roundMoves}>
                      You: <Text style={{ color: '#38BDF8', fontWeight: 'bold' }}>{r.player_move}</Text> vs Friend:{' '}
                      <Text style={{ color: '#F43F5E', fontWeight: 'bold' }}>{r.opponent_move}</Text>
                    </Text>
                    <Text
                      style={[
                        styles.roundResultPill,
                        r.result === 'PLAYER_WIN' && { color: '#86EFAC' },
                        r.result === 'OPPONENT_WIN' && { color: '#FDA4AF' },
                        r.result === 'DRAW' && { color: '#FDE047' },
                      ]}
                    >
                      {r.result === 'PLAYER_WIN' ? '✓ WIN' : r.result === 'OPPONENT_WIN' ? '✗ LOSS' : '= TIE'}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.rewardPill}>
                <Text style={styles.rewardText}>
                  +{outcome.xp_earned} Duel EXP • +{outcome.coins_earned} Data Credits
                </Text>
              </View>

              <TouchableOpacity style={styles.doneButton} onPress={handleClose}>
                <Text style={styles.doneButtonText}>Return to Radar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 13, 30, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  clayCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: GLASS_COLORS.bgDark,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1.8,
    borderColor: 'rgba(56, 189, 248, 0.45)',
    borderTopColor: 'rgba(186, 230, 253, 0.85)',
    borderBottomColor: 'rgba(56, 189, 248, 0.15)',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 22,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#F87171',
    fontWeight: 'bold',
  },
  vsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  clayFighterBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.20)',
    borderTopColor: 'rgba(255, 255, 255, 0.45)',
  },
  fighterEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  fighterName: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  fighterSub: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  vsBadge: {
    marginHorizontal: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F43F5E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFE4E6',
  },
  vsText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  sectionSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 10,
  },
  slotRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  slotPill: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  slotPillFilled: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  slotPillText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: 'bold',
  },
  movesGrid: {
    gap: 8,
    marginBottom: 14,
  },
  clayMoveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  overclockButton: {
    backgroundColor: '#0369A1',
    borderColor: '#38BDF8',
    borderTopColor: '#BAE6FD',
  },
  firewallButton: {
    backgroundColor: '#065F46',
    borderColor: '#22C55E',
    borderTopColor: '#A7F3D0',
  },
  empButton: {
    backgroundColor: '#9D174D',
    borderColor: '#F43F5E',
    borderTopColor: '#FECDD3',
  },
  moveEmoji: {
    fontSize: 22,
    marginRight: 10,
  },
  moveName: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
    flex: 1,
  },
  moveCounter: {
    color: '#FEF08A',
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  resetButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#334155',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetText: {
    color: '#CBD5E1',
    fontWeight: 'bold',
    fontSize: 12,
  },
  launchButton: {
    flex: 1,
    backgroundColor: '#FBBF24',
    paddingVertical: 12,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  launchButtonDisabled: {
    backgroundColor: '#475569',
    borderColor: '#64748B',
    shadowOpacity: 0,
  },
  launchText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  outcomeContainer: {
    alignItems: 'center',
  },
  outcomeTitle: {
    color: '#FEF08A',
    fontWeight: '900',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 4,
  },
  scoreText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 12,
  },
  roundsList: {
    width: '100%',
    gap: 6,
    marginBottom: 14,
  },
  roundCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    padding: 8,
    borderRadius: 12,
  },
  roundLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  roundMoves: {
    color: '#E2E8F0',
    fontSize: 11,
  },
  roundResultPill: {
    fontWeight: '900',
    fontSize: 11,
  },
  rewardPill: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderColor: '#22C55E',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 14,
  },
  rewardText: {
    color: '#86EFAC',
    fontWeight: 'bold',
    fontSize: 12,
  },
  doneButton: {
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 20,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
});

