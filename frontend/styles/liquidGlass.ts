import { StyleSheet } from 'react-native';

/**
 * Liquid Glass Design System for CampusQuest MMORPG
 * Features frosted translucency, specular rim highlights, organic pill contours,
 * and liquid neon caustics.
 */

export const GLASS_COLORS = {
  // Deep frosted backdrops
  bgDark: 'rgba(10, 18, 38, 0.72)',
  bgMedium: 'rgba(15, 25, 52, 0.65)',
  bgLight: 'rgba(30, 48, 88, 0.45)',
  bgUltraLight: 'rgba(255, 255, 255, 0.08)',

  // Specular rim borders
  rimTop: 'rgba(255, 255, 255, 0.45)',
  rimSide: 'rgba(255, 255, 255, 0.22)',
  rimBottom: 'rgba(255, 255, 255, 0.08)',
  rimGlow: 'rgba(56, 189, 248, 0.40)',

  // Liquid Neon Accents
  cyan: '#38BDF8',
  cyanGlow: 'rgba(56, 189, 248, 0.35)',
  cyanLight: 'rgba(56, 189, 248, 0.15)',

  emerald: '#10B981',
  emeraldGlow: 'rgba(16, 185, 129, 0.35)',
  emeraldLight: 'rgba(16, 185, 129, 0.15)',

  amber: '#F59E0B',
  amberGlow: 'rgba(245, 158, 11, 0.35)',
  amberLight: 'rgba(245, 158, 11, 0.15)',

  violet: '#A855F7',
  violetGlow: 'rgba(168, 85, 247, 0.35)',
  violetLight: 'rgba(168, 85, 247, 0.15)',

  crimson: '#EF4444',
  crimsonGlow: 'rgba(239, 68, 68, 0.35)',
  crimsonLight: 'rgba(239, 68, 68, 0.15)',

  textWhite: '#FFFFFF',
  textSubtle: '#94A3B8',
  textMuted: '#64748B',
};

export const liquidGlass = StyleSheet.create({
  // Base Floating Glass Card
  card: {
    backgroundColor: GLASS_COLORS.bgDark,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: GLASS_COLORS.rimSide,
    borderTopColor: GLASS_COLORS.rimTop,
    borderBottomColor: GLASS_COLORS.rimBottom,
    padding: 16,
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },

  // Interactive Glass Pill / Capsule
  pill: {
    backgroundColor: GLASS_COLORS.bgMedium,
    borderRadius: 9999,
    borderWidth: 1.2,
    borderColor: GLASS_COLORS.rimSide,
    borderTopColor: GLASS_COLORS.rimTop,
    borderBottomColor: GLASS_COLORS.rimBottom,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },

  // Pressable Glass Button
  button: {
    backgroundColor: 'rgba(30, 58, 110, 0.55)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.30)',
    borderTopColor: 'rgba(255, 255, 255, 0.55)',
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GLASS_COLORS.cyan,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },

  // Glass Button with Cyan Liquid Glow
  buttonCyan: {
    backgroundColor: 'rgba(14, 116, 144, 0.55)',
    borderColor: 'rgba(56, 189, 248, 0.6)',
    borderTopColor: 'rgba(186, 230, 253, 0.8)',
    shadowColor: '#38BDF8',
  },

  // Glass Button with Amber Gold Glow
  buttonAmber: {
    backgroundColor: 'rgba(180, 83, 9, 0.55)',
    borderColor: 'rgba(245, 158, 11, 0.6)',
    borderTopColor: 'rgba(254, 243, 199, 0.8)',
    shadowColor: '#F59E0B',
  },

  // Glass Button with Emerald Glow
  buttonEmerald: {
    backgroundColor: 'rgba(4, 120, 87, 0.55)',
    borderColor: 'rgba(16, 185, 129, 0.6)',
    borderTopColor: 'rgba(209, 250, 229, 0.8)',
    shadowColor: '#10B981',
  },

  // Floating Glass Modal Dialog
  modalCard: {
    backgroundColor: 'rgba(10, 18, 40, 0.90)',
    borderRadius: 28,
    borderWidth: 1.8,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    borderTopColor: 'rgba(255, 255, 255, 0.60)',
    borderBottomColor: 'rgba(255, 255, 255, 0.10)',
    padding: 24,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 16,
  },

  // Sleek Liquid Glass Input Field
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.60)',
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
  },
});

