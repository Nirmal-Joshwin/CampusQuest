import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CampusStronghold, defendStrongholdApi } from '../utils/turf';
import { liquidGlass, GLASS_COLORS } from '../styles/liquidGlass';
import { triggerHapticTap, triggerHapticSuccess, triggerHapticImpact } from '../utils/haptics';
import { playTapSound, playSwooshSound, playBattleSound } from '../utils/sound';

interface StrongholdModalProps {
  visible: boolean;
  onClose: () => void;
  stronghold: CampusStronghold | null;
  userDepartment?: string;
  token?: string | null;
  onDefended?: (updated: CampusStronghold) => void;
}

const DEPT_COLORS: Record<string, string> = {
  CSE: '#38BDF8',
  ECE: '#F59E0B',
  MECH: '#EF4444',
  CIVIL: '#10B981',
  'AI&DS': '#A855F7',
  UNCLAIMED: '#64748B',
};

export default function StrongholdModal({
  visible,
  onClose,
  stronghold,
  userDepartment = 'CSE',
  token,
  onDefended,
}: StrongholdModalProps) {
  const [defending, setDefending] = useState<boolean>(false);

  if (!stronghold) return null;

  const deptColor = DEPT_COLORS[stronghold.controlling_department] || '#38BDF8';
  const totalPoints = Object.values(stronghold.department_points).reduce((a, b) => a + b, 0) || 1;

  const handleDefend = async () => {
    setDefending(true);
    triggerHapticImpact('heavy');
    playBattleSound();
    try {
      const res = await defendStrongholdApi(stronghold.id, 'Campus Guardian', token);
      triggerHapticSuccess();
      Alert.alert('🏰 Stronghold Defended!', res.message);
      if (res.stronghold && onDefended) {
        onDefended(res.stronghold);
      }
      onClose();
    } catch (e) {
      console.warn('Defend error:', e);
    } finally {
      setDefending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.clayCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerIcon}>🏰</Text>
              <View>
                <Text style={styles.headerTitle}>{stronghold.name}</Text>
                <Text style={styles.headerSub}>{stronghold.landmark}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                triggerHapticTap();
                playSwooshSound();
                onClose();
              }}
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll}>
            {/* Controlling Department Clay Crest Banner */}
            <View style={[styles.crestBanner, { borderColor: deptColor }]}>
              <View style={[styles.crestPill, { backgroundColor: deptColor }]}>
                <Text style={styles.crestPillText}>
                  CONTROLLED BY: {stronghold.controlling_department}
                </Text>
              </View>
              <Text style={styles.defenseScoreText}>
                🛡️ {stronghold.defense_score.toLocaleString()} Control Points
              </Text>
              <Text style={styles.topDefenderText}>
                Lead Defender: <Text style={{ color: '#F8FAFC', fontWeight: 'bold' }}>{stronghold.top_defender}</Text>
              </Text>
            </View>

            {/* Active Department Buff */}
            <View style={styles.buffCard}>
              <Text style={styles.buffTitle}>⚡ ACTIVE SECTOR BONUS</Text>
              <Text style={styles.buffDesc}>{stronghold.active_buff}</Text>
              <Text style={styles.buffEligibility}>
                Granted to all <Text style={{ color: deptColor, fontWeight: 'bold' }}>{stronghold.controlling_department}</Text> students on campus!
              </Text>
            </View>

            {/* Department Dominance Breakdown */}
            <Text style={styles.sectionTitle}>CAMPUS TURF DOMINANCE</Text>
            <View style={styles.dominanceList}>
              {Object.entries(stronghold.department_points).map(([dept, pts]) => {
                const pct = Math.round((pts / totalPoints) * 100);
                const color = DEPT_COLORS[dept] || '#38BDF8';
                return (
                  <View key={dept} style={styles.deptRow}>
                    <View style={styles.deptLabelCol}>
                      <Text style={[styles.deptName, { color }]}>{dept}</Text>
                      <Text style={styles.deptPts}>{pts} pts ({pct}%)</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.defendButton, { backgroundColor: deptColor }]}
            activeOpacity={0.85}
            onPress={handleDefend}
            disabled={defending}
          >
            {defending ? (
              <ActivityIndicator size="small" color="#0F172A" />
            ) : (
              <>
                <Text style={styles.defendIcon}>🛡️</Text>
                <Text style={styles.defendText}>STATION CREATURE TO DEFEND</Text>
              </>
            )}
          </TouchableOpacity>
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
    maxWidth: 440,
    maxHeight: '85%',
    backgroundColor: GLASS_COLORS.bgDark,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1.8,
    borderColor: 'rgba(99, 102, 241, 0.45)',
    borderTopColor: 'rgba(199, 210, 254, 0.85)',
    borderBottomColor: 'rgba(99, 102, 241, 0.15)',
    shadowColor: '#818CF8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    fontSize: 30,
    marginRight: 10,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 16,
  },
  headerSub: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
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
  scroll: {
    marginBottom: 14,
  },
  crestBanner: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 22,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
    marginBottom: 12,
  },
  crestPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },
  crestPillText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  defenseScoreText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 18,
    marginVertical: 2,
  },
  topDefenderText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  buffCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#6366F1',
    marginBottom: 14,
  },
  buffTitle: {
    color: '#FEF08A',
    fontWeight: '900',
    fontSize: 11,
    marginBottom: 2,
  },
  buffDesc: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 2,
  },
  buffEligibility: {
    color: '#CBD5E1',
    fontSize: 10,
  },
  sectionTitle: {
    color: '#38BDF8',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  dominanceList: {
    gap: 8,
    marginBottom: 12,
  },
  deptRow: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 8,
  },
  deptLabelCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  deptName: {
    fontWeight: '900',
    fontSize: 12,
  },
  deptPts: {
    color: '#94A3B8',
    fontSize: 11,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  defendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    borderTopColor: 'rgba(255, 255, 255, 0.85)',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  defendIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  defendText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
});

