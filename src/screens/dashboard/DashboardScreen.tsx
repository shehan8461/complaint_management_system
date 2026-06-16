import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
  Animated,
  Dimensions,
  Image,
  Alert,
  TouchableWithoutFeedback,
  DeviceEventEmitter,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthService } from '../../services/AuthService';
import { DashboardService, CMSDashboardSummary, CMSComplaintListItem } from '../../services/DashboardService';

const { width, height } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.75;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatusDisplay(status: number): { label: string; color: string; bg: string } {
  switch (status) {
    case 1: return { label: 'New', color: '#b91c1c', bg: '#fef2f2' }; // Red
    case 2:
    case 3:
    case 4:
    case 5: return { label: 'Assigned', color: '#1d4ed8', bg: '#eff6ff' }; // Blue
    case 6: return { label: 'Resolved', color: '#15803d', bg: '#f0fdf4' }; // Green
    case 7: return { label: 'Closed', color: '#4b5563', bg: '#f3f4f6' }; // Gray
    case 8: return { label: 'In Progress', color: '#b45309', bg: '#fffbeb' }; // Yellow
    case 9: return { label: 'Awaiting Info', color: '#a21caf', bg: '#fdf4ff' }; // Purple
    default: return { label: 'Unknown', color: '#4b5563', bg: '#f3f4f6' };
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Components ──────────────────────────────────────────────────────────────

export function DashboardScreen() {
  const [userEmail, setUserEmail] = useState('User');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [stats, setStats] = useState<CMSDashboardSummary | null>(null);
  const [complaints, setComplaints] = useState<CMSComplaintListItem[]>([]);

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const toggleDrawer = useCallback(() => {
    const toValue = isDrawerOpen ? -DRAWER_WIDTH : 0;
    const overlayToValue = isDrawerOpen ? 0 : 1;
    
    // Toggle state right away for touch events, or after animation for closing
    if (!isDrawerOpen) setIsDrawerOpen(true);

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: overlayToValue,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (isDrawerOpen) setIsDrawerOpen(false);
    });
  }, [isDrawerOpen, slideAnim, overlayAnim]);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Sign Out', 
        style: 'destructive',
        onPress: async () => {
          try {
            await AuthService.logout();
            DeviceEventEmitter.emit('LOGOUT');
          } catch (e) {
            console.error('Failed to logout:', e);
          }
        }
      }
    ]);
  };

  const loadData = useCallback(async () => {
    try {
      // Get current user info
      const user = await AuthService.getMe();
      if (user) {
        setUserEmail(user.email || user.username || 'User');
        setIsAdmin(user.roles?.includes(9) ?? false);
      }

      // Fetch summary
      const summary = await DashboardService.getSummary();
      setStats(summary);

      // Fetch complaints
      const isCmsAdmin = user?.roles?.includes(9);
      const complaintsData = isCmsAdmin
        ? await DashboardService.getAllComplaints(1, 20)
        : await DashboardService.getAssignedComplaints(1, 20);
      
      setComplaints(complaintsData.items || []);
    } catch (error) {
      console.error('[DashboardScreen] Failed to load data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  // ─── Renderers ─────────────────────────────────────────────────────────────

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTopRow}>
        <TouchableOpacity style={styles.menuButton} onPress={toggleDrawer}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Complaints Overview</Text>
          <Text style={styles.headerSubtitle}>Welcome back, {userEmail}</Text>
        </View>
      </View>

      {/* Stat Cards Grid */}
      {stats && (
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { borderLeftColor: '#ef4444' }]}>
            <Text style={styles.statLabel}>Critical</Text>
            <Text style={styles.statValue}>{stats.criticalComplaints ?? 0}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#f59e0b' }]}>
            <Text style={styles.statLabel}>Pending</Text>
            <Text style={styles.statValue}>{stats.pendingComplaints ?? 0}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#3b82f6' }]}>
            <Text style={styles.statLabel}>Total</Text>
            <Text style={styles.statValue}>{stats.totalComplaints ?? 0}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#10b981' }]}>
            <Text style={styles.statLabel}>Resolved</Text>
            <Text style={styles.statValue}>{stats.resolvedComplaints ?? 0}</Text>
          </View>
        </View>
      )}

      <View style={styles.listHeaderRow}>
        <Text style={styles.listHeaderTitle}>Recent Complaints</Text>
        <TouchableOpacity>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderComplaintItem = ({ item }: { item: CMSComplaintListItem }) => {
    const statusInfo = getStatusDisplay(item.status);
    return (
      <TouchableOpacity style={styles.complaintCard} activeOpacity={0.7}>
        <View style={styles.complaintHeader}>
          <Text style={styles.complaintNumber}>{item.complaintNumber}</Text>
          <View style={[styles.badge, { backgroundColor: statusInfo.bg }]}>
            <Text style={[styles.badgeText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>
        </View>
        <Text style={styles.complaintTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.complaintFooter}>
          <Text style={styles.complaintCategory} numberOfLines={1}>{item.category}</Text>
          <Text style={styles.complaintDate}>{formatDate(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading Dashboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" />
      <FlatList
        data={complaints}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderComplaintItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>Inbox</Text>
            <Text style={styles.emptyText}>No complaints found.</Text>
          </View>
        }
      />

      {/* ─── Custom Drawer Overlay ─── */}
      {isDrawerOpen && (
        <Animated.View 
          style={[styles.overlay, { opacity: overlayAnim }]}
        >
          <TouchableWithoutFeedback onPress={toggleDrawer}>
            <View style={styles.overlayBackground} />
          </TouchableWithoutFeedback>
        </Animated.View>
      )}

      <Animated.View style={[styles.drawerContainer, { transform: [{ translateX: slideAnim }] }]}>
        <SafeAreaView style={styles.drawerSafeArea} edges={['top', 'bottom']}>
          {/* Drawer Header */}
          <View style={styles.drawerHeader}>
            <Image 
              source={require('../../assets/logos/cat20.png')} 
              style={styles.drawerLogo} 
              resizeMode="contain" 
            />
            <Text style={styles.drawerTitle}>CAT2020 CMS</Text>
          </View>

          {/* Drawer Links */}
          <View style={styles.drawerLinksContainer}>
            <TouchableOpacity style={styles.drawerLinkActive} onPress={toggleDrawer}>
              <Text style={styles.drawerLinkIcon}>📊</Text>
              <Text style={styles.drawerLinkTextActive}>Dashboard</Text>
            </TouchableOpacity>
          </View>

          {/* Drawer Footer */}
          <View style={styles.drawerFooter}>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutBtnText}>🚪 Sign Out</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  menuButton: {
    marginRight: 16,
    padding: 8,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  menuIcon: {
    fontSize: 20,
    color: '#111827',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginTop: 8,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  listHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  complaintCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  complaintNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4b5563',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  complaintTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
    lineHeight: 22,
  },
  complaintFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
  },
  complaintCategory: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
    marginRight: 8,
  },
  complaintDate: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 24,
    color: '#d1d5db',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#6b7280',
  },

  // ─── Custom Drawer Styles ───
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10,
  },
  overlayBackground: {
    flex: 1,
  },
  drawerContainer: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#ffffff',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  drawerSafeArea: {
    flex: 1,
  },
  drawerHeader: {
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    marginBottom: 10,
  },
  drawerLogo: {
    width: 70,
    height: 70,
    marginBottom: 10,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  drawerLinksContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  drawerLinkActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  drawerLinkIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  drawerLinkTextActive: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563eb',
  },
  drawerFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  logoutBtn: {
    paddingVertical: 14,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutBtnText: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '700',
  },
});
