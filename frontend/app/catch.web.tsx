import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function WebCatchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; name?: string; distance?: string }>();
  const creatureName = params.name || 'Campus Monster';

  const [caught, setCaught] = useState(false);

  const handleCatchCreature = () => {
    if (caught) return;
    setCaught(true);

    if (typeof window !== 'undefined' && window.alert) {
      window.alert(`🎉 Caught! You successfully caught ${creatureName}! Added to your CampusQuest Pokedex.`);
      router.back();
    } else {
      Alert.alert(
        '🎉 Caught!',
        `You successfully caught ${creatureName}! Added to your CampusQuest Pokedex.`,
        [{ text: 'Great!', onPress: () => router.back() }]
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHud}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>✕ Escape to Radar</Text>
        </TouchableOpacity>
        <View style={styles.targetBadge}>
          <Text style={styles.targetBadgeText}>⚡ WILD ENCOUNTER (WEB AR SIMULATOR)</Text>
        </View>
      </View>

      {/* AR Simulation Viewport */}
      <View style={styles.viewport}>
        {/* Animated Reticle */}
        <View style={styles.reticleRing}>
          <View style={styles.innerReticleRing} />
        </View>

        {/* 2D Interactive Target */}
        <TouchableOpacity
          style={[styles.creatureCard, caught && styles.creatureCardCaught]}
          activeOpacity={0.7}
          onPress={handleCatchCreature}
        >
          <View style={styles.avatarBox}>
            <Text style={styles.avatarEmoji}>👾</Text>
          </View>
          <Text style={styles.creatureNameText}>{creatureName}</Text>
          <View style={styles.tapToCatchBadge}>
            <Text style={styles.tapToCatchText}>✨ CLICK TO CATCH ✨</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Bottom CTA */}
      <View style={styles.bottomHud}>
        <TouchableOpacity
          style={styles.throwCatchButton}
          activeOpacity={0.85}
          onPress={handleCatchCreature}
        >
          <Text style={styles.throwButtonText}>🎯 CAPTURE CREATURE</Text>
        </TouchableOpacity>
        <Text style={styles.hintText}>Click anywhere on the creature to capture!</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
  },
  topHud: {
    width: '100%',
    maxWidth: 600,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    cursor: 'pointer' as any,
  },
  backButtonText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: 'bold',
  },
  targetBadge: {
    backgroundColor: '#DC2626',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  targetBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  viewport: {
    width: '100%',
    maxWidth: 500,
    height: 400,
    borderRadius: 24,
    backgroundColor: '#0B1329',
    borderWidth: 2,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  reticleRing: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 2,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerReticleRing: {
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  creatureCard: {
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer' as any,
    zIndex: 10,
  },
  creatureCardCaught: {
    opacity: 0.4,
    transform: [{ scale: 0.8 }],
  },
  avatarBox: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#0F172A',
    borderWidth: 3,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
  },
  avatarEmoji: {
    fontSize: 60,
  },
  creatureNameText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 16,
    letterSpacing: 0.5,
  },
  tapToCatchBadge: {
    backgroundColor: '#16A34A',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  tapToCatchText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  bottomHud: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  throwCatchButton: {
    backgroundColor: '#E11D48',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FDA4AF',
    cursor: 'pointer' as any,
  },
  throwButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  hintText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 8,
  },
});

