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
  ScrollView,
  Modal,
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

function getFullStatusLabel(status: number): string {
  switch (status) {
    case 1: return 'New';
    case 2: return 'Assigned to Department Head';
    case 3: return 'Assigned to Subject';
    case 4: return 'Reassigned to Department Head';
    case 5: return 'Admin Check';
    case 6: return 'Resolved';
    case 7: return 'Closed';
    case 8: return 'In Progress';
    case 9: return 'Awaiting Info';
    default: return 'Unknown';
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Components ──────────────────────────────────────────────────────────────

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const [userEmail, setUserEmail] = useState('User');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [stats, setStats] = useState<CMSDashboardSummary | null>(null);
  const [complaints, setComplaints] = useState<CMSComplaintListItem[]>([]);

  const [selectedStatus, setSelectedStatus] = useState<string>('All Statuses');
  const [selectedService, setSelectedService] = useState<string>('All Services');
  const [statusOptions, setStatusOptions] = useState<string[]>(['All Statuses']);
  const [serviceOptions, setServiceOptions] = useState<string[]>(['All Services']);
  const [activeDropdown, setActiveDropdown] = useState<'status' | 'service' | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{top: number, left?: number, right?: number, width: number}>({ top: 0, width: 0 });
  const serviceBtnRef = useRef<any>(null);
  const statusBtnRef = useRef<any>(null);

  const openDropdown = (type: 'status' | 'service', ref: any) => {
    ref.current?.measure((x: number, y: number, btnWidth: number, btnHeight: number, pageX: number, pageY: number) => {
      // If the button is on the right half of the screen, anchor the dropdown to the right edge
      const isRightSide = pageX + btnWidth / 2 > width / 2;
      
      setDropdownPos({ 
        top: pageY + btnHeight + 4, 
        left: isRightSide ? undefined : pageX,
        right: isRightSide ? width - (pageX + btnWidth) : undefined,
        width: btnWidth
      });
      setActiveDropdown(type);
    });
  };

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
        setIsAdmin(!!(user.roles?.includes('9') || user.roles?.includes(9)));
      }

      // Fetch summary
      const summary = await DashboardService.getSummary();
      setStats(summary);

      // Fetch complaints
      const isCmsAdmin = !!(user?.roles?.includes('9') || user?.roles?.includes(9));
      const complaintsData = isCmsAdmin
        ? await DashboardService.getAllComplaints(1, 100)
        : await DashboardService.getAssignedComplaints(1, 100);
      
      setComplaints(complaintsData.items || []);

      // Build dropdown options dynamically based on the dataset
      const items = complaintsData.items || [];
      const statuses = Array.from(new Set(items.map(c => getFullStatusLabel(c.status)))).filter(Boolean).sort();
      const dynamicServices = Array.from(new Set(items.map(c => c.serviceName || c.category))).filter(Boolean).sort();
      
      // Ensure "Current Tenant" is always available as an option
      const services = dynamicServices.includes('Current Tenant') 
        ? dynamicServices 
        : ['Current Tenant', ...dynamicServices];

      setStatusOptions(['All Statuses', ...statuses]);
      setServiceOptions(['All Services', ...services]);
    } catch (error: any) {
      console.error('[DashboardScreen] Failed to load data:', error);
      if (error?.response?.status === 401) {
        Alert.alert(
          'Session Expired', 
          'Your session has expired. Please log in again.', 
          [{ text: 'OK', onPress: () => DeviceEventEmitter.emit('LOGOUT') }]
        );
      }
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

  const getFilteredComplaints = () => {
    return complaints.filter(c => {
      const fullStatusLabel = getFullStatusLabel(c.status);
      const matchesStatus = selectedStatus === 'All Statuses' || fullStatusLabel === selectedStatus;
      
      const serviceLabel = c.serviceName || c.category;
      const matchesService = selectedService === 'All Services' || serviceLabel === selectedService;

      return matchesStatus && matchesService;
    });
  };

  const getDashboardStatusGroup = (status?: string) => {
    const compact = (status || '').toLowerCase().replace(/[\s_-]/g, '');
    if (compact === 'resolved') return 'resolved';
    if (compact === 'closed') return 'closed';
    if (compact === 'new') return 'new';
    return 'in-progress';
  };

  const getCalculatedStats = () => {
    let pending = 0;
    let inProgress = 0;
    let resolved = 0;

    if (stats?.byStatus && Object.keys(stats.byStatus).length > 0) {
      Object.entries(stats.byStatus).forEach(([status, count]) => {
        const group = getDashboardStatusGroup(status);
        if (group === 'resolved' || group === 'closed') resolved += count;
        else if (group === 'new') pending += count;
        else inProgress += count;
      });
    } else {
      pending = stats?.pendingComplaints ?? 0;
      resolved = stats?.resolvedComplaints ?? 0;
      inProgress = stats?.inProgressComplaints ?? 0;
    }

    return {
      total: stats?.totalComplaints ?? 0,
      critical: stats?.criticalComplaints ?? 0,
      pending,
      inProgress,
      resolved
    };
  };

  const renderHeader = () => {
    const calcStats = getCalculatedStats();
    return (
      <View style={styles.header}>
      {/* Stat Cards Grid */}
      {stats && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.statsGrid}
        >
          {/* Critical Card */}
          <View style={styles.statCardCompact}>
            <View style={styles.statCardTop}>
              <View style={[styles.statIconCircle, { backgroundColor: '#fef2f2' }]}>
                <Text style={{ fontSize: 14 }}>⚠</Text>
              </View>
              <View style={[styles.statChip, { backgroundColor: '#fef2f2' }]}>
                <Text style={[styles.statChipText, { color: '#ef4444' }]}>PRIORITY</Text>
              </View>
            </View>
            <Text style={styles.statValueCompact}>{calcStats.critical}</Text>
            <Text style={styles.statLabelCompact}>Critical</Text>
            <View style={styles.statProgressBlockCompact}>
              <View style={styles.progressBarBgCompact}>
                <View style={[styles.progressBarFill, { backgroundColor: '#ef4444', width: `${calcStats.total ? (calcStats.critical / calcStats.total) * 100 : 0}%` }]} />
              </View>
              <Text style={styles.statMetaCompact}>{calcStats.total ? Math.round((calcStats.critical / calcStats.total) * 100) : 0}% of total</Text>
            </View>
          </View>

          {/* Pending Card */}
          <View style={styles.statCardCompact}>
            <View style={styles.statCardTop}>
              <View style={[styles.statIconCircle, { backgroundColor: '#fff7ed' }]}>
                <Text style={{ fontSize: 14 }}>⏱</Text>
              </View>
              <View style={[styles.statChip, { backgroundColor: '#fff7ed' }]}>
                <Text style={[styles.statChipText, { color: '#f97316' }]}>OPEN</Text>
              </View>
            </View>
            <Text style={styles.statValueCompact}>{calcStats.pending}</Text>
            <Text style={styles.statLabelCompact}>Pending</Text>
            <View style={styles.statProgressBlockCompact}>
              <View style={styles.progressBarBgCompact}>
                <View style={[styles.progressBarFill, { backgroundColor: '#f97316', width: `${calcStats.total ? (calcStats.pending / calcStats.total) * 100 : 0}%` }]} />
              </View>
              <Text style={styles.statMetaCompact}>{calcStats.total ? Math.round((calcStats.pending / calcStats.total) * 100) : 0}% of total</Text>
            </View>
          </View>

          {/* In Progress Card */}
          <View style={styles.statCardCompact}>
            <View style={styles.statCardTop}>
              <View style={[styles.statIconCircle, { backgroundColor: '#eef2ff' }]}>
                <Text style={{ fontSize: 14 }}>📋</Text>
              </View>
              <View style={[styles.statChip, { backgroundColor: '#eef2ff' }]}>
                <Text style={[styles.statChipText, { color: '#6366f1' }]}>ACTIVE</Text>
              </View>
            </View>
            {/* @ts-ignore - inProgressComplaints might not be typed yet */}
            <Text style={styles.statValueCompact}>{calcStats.inProgress}</Text>
            <Text style={styles.statLabelCompact}>In Progress</Text>
            <View style={styles.statProgressBlockCompact}>
              <View style={styles.progressBarBgCompact}>
                {/* @ts-ignore */}
                <View style={[styles.progressBarFill, { backgroundColor: '#6366f1', width: `${calcStats.total ? (calcStats.inProgress / calcStats.total) * 100 : 0}%` }]} />
              </View>
              {/* @ts-ignore */}
              <Text style={styles.statMetaCompact}>{calcStats.total ? Math.round((calcStats.inProgress / calcStats.total) * 100) : 0}% of total</Text>
            </View>
          </View>

          {/* Resolved Card */}
          <View style={styles.statCardCompact}>
            <View style={styles.statCardTop}>
              <View style={[styles.statIconCircle, { backgroundColor: '#ecfdf5' }]}>
                <Text style={{ fontSize: 14 }}>✓</Text>
              </View>
              <View style={[styles.statChip, { backgroundColor: '#ecfdf5' }]}>
                <Text style={[styles.statChipText, { color: '#10b981' }]}>RATE</Text>
              </View>
            </View>
            <Text style={styles.statValueCompact}>{calcStats.resolved}</Text>
            <Text style={styles.statLabelCompact}>Resolved</Text>
            <View style={styles.statProgressBlockCompact}>
              <View style={styles.progressBarBgCompact}>
                <View style={[styles.progressBarFill, { backgroundColor: '#10b981', width: `${calcStats.total ? (calcStats.resolved / calcStats.total) * 100 : 0}%` }]} />
              </View>
              <Text style={styles.statMetaCompact}>{calcStats.total ? Math.round((calcStats.resolved / calcStats.total) * 100) : 0}% res rate</Text>
            </View>
          </View>
        </ScrollView>
      )}

      <View style={styles.listHeaderRow}>
        <Text style={styles.listHeaderTitle}>Recent Complaints</Text>
      </View>
      <View style={styles.filtersRow}>
        <TouchableOpacity 
          ref={serviceBtnRef}
          style={styles.filterDropdownBtn}
          onPress={() => openDropdown('service', serviceBtnRef)}
        >
          <Text style={styles.filterDropdownText} numberOfLines={1}>{selectedService} ▼</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          ref={statusBtnRef}
          style={styles.filterDropdownBtn}
          onPress={() => openDropdown('status', statusBtnRef)}
        >
          <Text style={styles.filterDropdownText} numberOfLines={1}>{selectedStatus} ▼</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const renderComplaintItem = ({ item }: { item: CMSComplaintListItem }) => {
    const statusInfo = getStatusDisplay(item.status);
    return (
      <View style={styles.complaintCard}>
        <View style={styles.complaintHeader}>
          <Text style={styles.complaintNumber}>{(item.complaintNumber || (item as any).ticketNo || (item as any).TicketNo)}</Text>
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
        <View style={styles.complaintActionRow}>
          <TouchableOpacity 
            style={styles.viewButton} 
            activeOpacity={0.7}
            onPress={() => {
              const ticketNo = item.complaintNumber || (item as any).ticketNo || (item as any).TicketNo;
              navigation.navigate('ComplaintDetail', { complaintNumber: ticketNo });
            }}
          >
            <Text style={styles.viewButtonText}>View Details</Text>
          </TouchableOpacity>
        </View>
      </View>
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
      
      {/* Dropdown Modal */}
      <Modal visible={activeDropdown !== null} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setActiveDropdown(null)}>
          <View style={styles.dropdownOverlayAbsolute}>
            <View style={[
              styles.dropdownMenuAbsolute, 
              { 
                top: dropdownPos.top, 
                width: dropdownPos.width,
                ...(dropdownPos.left !== undefined ? { left: dropdownPos.left } : {}),
                ...(dropdownPos.right !== undefined ? { right: dropdownPos.right } : {})
              }
            ]}>
              <ScrollView style={{ maxHeight: 300 }}>
                {(activeDropdown === 'status' ? statusOptions : serviceOptions).map(option => {
                  const isActive = (activeDropdown === 'status' ? selectedStatus : selectedService) === option;
                  return (
                    <TouchableOpacity 
                      key={option} 
                      style={styles.dropdownItemCentered}
                      onPress={() => {
                        if (activeDropdown === 'status') setSelectedStatus(option);
                        else setSelectedService(option);
                        setActiveDropdown(null);
                      }}
                    >
                      <Text style={[
                        styles.dropdownItemTextCentered, 
                        isActive && styles.dropdownItemTextActive
                      ]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <View style={styles.headerTopRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={styles.menuButton} onPress={toggleDrawer}>
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
          <Image source={require('../../assets/logos/cat20.png')} style={styles.headerLogo} resizeMode="contain" />
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.headerSubtitle}>{userEmail}</Text>
        </View>
      </View>

      <FlatList
        data={getFilteredComplaints()}
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
        ListFooterComponent={
          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>
              {new Date().getFullYear()}© All Rights Reserved - CAT20.CMS
            </Text>
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
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F4C81',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a24',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  headerLogo: {
    width: 160,
    height: 48,
    marginLeft: 0,
  },
  menuButton: {
    marginRight: 12,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  menuIcon: {
    fontSize: 20,
    color: '#ffffff',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingBottom: 24,
    gap: 12,
    paddingRight: 16, // So the last card doesn't stick to the edge
  },
  statCardCompact: {
    width: 150, // Fixed width for horizontal scrolling
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  statCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabelCompact: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  statChip: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statChipText: {
    fontSize: 8,
    fontWeight: '800',
  },
  statValueCompact: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
  statProgressBlockCompact: {
    marginTop: 'auto',
  },
  progressBarBgCompact: {
    height: 3,
    backgroundColor: '#f3f4f6',
    borderRadius: 1.5,
    marginBottom: 4,
  },
  progressBarFill: {
    height: 3,
    borderRadius: 1.5,
  },
  statMetaCompact: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '500',
  },
  listHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    marginBottom: 12,
    gap: 8,
  },
  filterDropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  filterDropdownText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
  dropdownOverlayAbsolute: {
    flex: 1,
  },
  dropdownMenuAbsolute: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    overflow: 'hidden',
  },
  dropdownItemCentered: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dropdownItemTextCentered: {
    fontSize: 15,
    fontWeight: '500',
    color: '#4b5563',
    textAlign: 'center',
  },
  dropdownItemTextActive: {
    color: '#2563eb',
    fontWeight: '700',
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
  complaintActionRow: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
    alignItems: 'flex-end',
  },
  viewButton: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  viewButtonText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '600',
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
  footerContainer: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    marginTop: 20,
    borderRadius: 12,
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
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
    backgroundColor: '#0F4C81',
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
    color: '#ffffff',
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
    color: '#2563EB',
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
