import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import {
  fetchShopItemsApi,
  buyShopItemApi,
  ShopItemData,
} from '../utils/api';
import { liquidGlass, GLASS_COLORS } from '../styles/liquidGlass';
import { triggerHapticTap, triggerHapticSuccess, triggerHapticWarning } from '../utils/haptics';
import { playTapSound, playSwooshSound, playCoinSound } from '../utils/sound';

export default function ShopScreen() {
  const router = useRouter();
  const { user, token, updateProfile } = useAuth();

  const [items, setItems] = useState<ShopItemData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'SUPPLIES' | 'BUFFS' | 'TITLES'>('ALL');
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  useEffect(() => {
    loadShop();
  }, []);

  const loadShop = async () => {
    setLoading(true);
    try {
      const data = await fetchShopItemsApi();
      setItems(data);
    } catch (e) {
      console.error('Failed to load shop items:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (item: ShopItemData) => {
    const userCoins = user?.coins || 50;

    if (userCoins < item.cost_coins) {
      triggerHapticWarning();
      Alert.alert(
        '⚠️ Insufficient Data Credits',
        `You have ${userCoins}💎 Data Credits, but this item requires ${item.cost_coins}💎.\n\nExplore CIT campus, discover landmarks, and unlock supply caches to earn more credits!`,
        [{ text: 'Understood', style: 'default' }]
      );
      return;
    }

    Alert.alert(
      `Redeem ${item.name}?`,
      `Cost: ${item.cost_coins}💎 Data Credits\n\n${item.description}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem Now',
          onPress: async () => {
            try {
              setPurchasingId(item.id);
              const result = await buyShopItemApi(item.id, token);

              if (user) {
                let updatedCoins = (user.coins ?? 50) - item.cost_coins;
                let updatedEnergy = user.energy;
                let updatedTitle = user.avatar_title;

                if (item.effect_type === 'ENERGY_RESTORE') {
                  const restoreAmt = parseInt(item.effect_value, 10);
                  updatedEnergy = Math.min(user.max_energy, user.energy + restoreAmt);
                } else if (item.effect_type === 'TITLE') {
                  updatedTitle = item.effect_value;
                }

                updateProfile({
                  coins: updatedCoins,
                  energy: updatedEnergy,
                  avatar_title: updatedTitle,
                });
              }

              triggerHapticSuccess();
              playCoinSound();
              Alert.alert('🎁 Reward Claimed!', `${result.message || `Successfully acquired ${item.name}!`}`);
            } catch (err: any) {
              triggerHapticWarning();
              Alert.alert('⚠️ Transaction Failed', err.message || 'Could not complete redemption.');
            } finally {
              setPurchasingId(null);
            }
          },
        },
      ]
    );
  };

  const filteredItems = items.filter((i) => {
    if (selectedCategory === 'ALL') return true;
    return i.category === selectedCategory;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Cyber Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              triggerHapticTap();
              playSwooshSound();
              router.back();
            }}
          >
            <Text style={styles.backButtonText}>← Radar</Text>
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>🏛️ CIT Campus Armory</Text>
            <Text style={styles.headerSubtitle}>Redeem Data Credits for Gear & Perks</Text>
          </View>
        </View>

        {/* Live Wallet & Health Bar Card */}
        <View style={styles.walletCard}>
          <View style={styles.walletRow}>
            <View style={styles.walletStatBox}>
              <Text style={styles.walletStatLabel}>DATA CREDITS</Text>
              <Text style={styles.walletStatValue}>💎 {user?.coins ?? 50}</Text>
            </View>
            <View style={styles.walletDivider} />
            <View style={styles.walletStatBox}>
              <Text style={styles.walletStatLabel}>CURRENT ENERGY</Text>
              <Text style={[styles.walletStatValue, { color: '#10B981' }]}>
                ⚡ {user?.energy ?? 100}/{user?.max_energy ?? 100}
              </Text>
            </View>
            <View style={styles.walletDivider} />
            <View style={styles.walletStatBox}>
              <Text style={styles.walletStatLabel}>CADET RANK</Text>
              <Text style={[styles.walletStatValue, { color: '#F59E0B' }]}>
                ⭐ Lvl {user?.level ?? 1}
              </Text>
            </View>
          </View>

          {user?.avatar_title && (
            <View style={styles.titleBadgeRow}>
              <Text style={styles.currentTitleText}>Active Title: {user.avatar_title}</Text>
            </View>
          )}
        </View>

        {/* Category Filter Tabs */}
        <View style={styles.tabsContainer}>
          {(['ALL', 'SUPPLIES', 'BUFFS', 'TITLES'] as const).map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.tabButton, selectedCategory === cat && styles.tabButtonActive]}
              onPress={() => {
                triggerHapticTap();
                playTapSound();
                setSelectedCategory(cat);
              }}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  selectedCategory === cat && styles.tabButtonTextActive,
                ]}
              >
                {cat === 'ALL'
                  ? 'All'
                  : cat === 'SUPPLIES'
                  ? '⚡ Supplies'
                  : cat === 'BUFFS'
                  ? '📡 Perks'
                  : '👑 Titles'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Catalog Items List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#38BDF8" />
            <Text style={styles.loadingText}>Connecting to CIT Campus Quartermaster...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollList}
            contentContainerStyle={styles.scrollListContent}
            showsVerticalScrollIndicator={false}
          >
            {filteredItems.map((item) => {
              const userCoins = user?.coins || 50;
              const canAfford = userCoins >= item.cost_coins;
              const isBuying = purchasingId === item.id;

              return (
                <View key={item.id} style={styles.itemCard}>
                  <View style={styles.itemIconContainer}>
                    <Text style={styles.itemIcon}>{item.icon}</Text>
                  </View>

                  <View style={styles.itemInfo}>
                    <View style={styles.itemTitleRow}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>{item.category}</Text>
                      </View>
                    </View>

                    <Text style={styles.itemDesc}>{item.description}</Text>

                    <View style={styles.itemActionRow}>
                      <View style={styles.costBadge}>
                        <Text style={styles.costText}>{item.cost_coins} 💎</Text>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.buyButton,
                          !canAfford && styles.buyButtonDisabled,
                          isBuying && styles.buyButtonLoading,
                        ]}
                        onPress={() => handleBuy(item)}
                        disabled={!canAfford || isBuying}
                      >
                        {isBuying ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text
                            style={[
                              styles.buyButtonText,
                              !canAfford && styles.buyButtonTextDisabled,
                            ]}
                          >
                            {canAfford ? 'Redeem' : 'Need Credits'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070D1E',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 24 : 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderTopColor: 'rgba(255, 255, 255, 0.50)',
    marginRight: 12,
  },
  backButtonText: {
    color: '#38BDF8',
    fontWeight: 'bold',
    fontSize: 13,
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  walletCard: {
    backgroundColor: GLASS_COLORS.bgDark,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1.5,
    borderColor: GLASS_COLORS.rimSide,
    borderTopColor: GLASS_COLORS.rimTop,
    borderBottomColor: GLASS_COLORS.rimBottom,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
    marginBottom: 14,
  },
  walletRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  walletStatBox: {
    alignItems: 'center',
  },
  walletStatLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  walletStatValue: {
    color: '#38BDF8',
    fontSize: 15,
    fontWeight: '900',
  },
  walletDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  titleBadgeRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  currentTitleText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: 'bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    backgroundColor: GLASS_COLORS.bgDark,
    padding: 4,
    borderRadius: 9999,
    borderWidth: 1.2,
    borderColor: GLASS_COLORS.rimSide,
    borderTopColor: GLASS_COLORS.rimTop,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9999,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(14, 116, 144, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.6)',
    borderTopColor: 'rgba(186, 230, 253, 0.85)',
  },
  tabButtonText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 12,
  },
  scrollList: {
    flex: 1,
  },
  scrollListContent: {
    paddingBottom: 24,
    gap: 12,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: GLASS_COLORS.bgDark,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: GLASS_COLORS.rimSide,
    borderTopColor: GLASS_COLORS.rimTop,
    borderBottomColor: GLASS_COLORS.rimBottom,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  itemIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(30, 48, 88, 0.45)',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.5)',
    borderTopColor: 'rgba(186, 230, 253, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  itemIcon: {
    fontSize: 26,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
  },
  categoryBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  categoryBadgeText: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: 'bold',
  },
  itemDesc: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
  },
  itemActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.20)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
    borderTopColor: 'rgba(254, 243, 199, 0.7)',
  },
  costText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: 'bold',
  },
  buyButton: {
    backgroundColor: 'rgba(14, 116, 144, 0.65)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(56, 189, 248, 0.6)',
    borderTopColor: 'rgba(186, 230, 253, 0.85)',
    minWidth: 85,
    alignItems: 'center',
  },
  buyButtonDisabled: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderColor: 'rgba(71, 85, 105, 0.4)',
  },
  buyButtonLoading: {
    opacity: 0.7,
  },
  buyButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  buyButtonTextDisabled: {
    color: '#64748B',
  },
});
