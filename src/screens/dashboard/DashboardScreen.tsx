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
  TextInput,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthService } from '../../services/AuthService';
import { DashboardService, CMSDashboardSummary, CMSComplaintListItem } from '../../services/DashboardService';

const { width, height } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.75;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatusDisplay(status: number): { label: string; color: string; bg: string } {
  switch (status) {
    case 1: return { label: 'Pending', color: '#f97316', bg: '#fff7ed' }; // Orange
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
    case 1: return 'Pending';
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
  const [selectedStatGroup, setSelectedStatGroup] = useState<string | null>('Pending');

  const [statusOptions, setStatusOptions] = useState<string[]>(['All Statuses']);
  const [serviceOptions, setServiceOptions] = useState<string[]>(['All Services']);
  const [activeDropdown, setActiveDropdown] = useState<'service' | 'status' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPos, setDropdownPos] = useState<{ top: number, left?: number, right?: number, width: number }>({ top: 0, width: 0 });
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

      const items = complaintsData.items || [];
      const dynamicServices = Array.from(new Set(items.map(c => c.serviceName || c.category))).filter(Boolean).sort();

      const services = dynamicServices.filter(s => s !== 'Current Tenant');

      // Build statuses dynamically like web code
      const statuses = Array.from(new Set(items.map(c => getFullStatusLabel(c.status)))).filter(Boolean).sort();
      const finalStatuses = statuses.includes('Pending')
        ? statuses
        : ['Pending', ...statuses];

      setStatusOptions(['All Statuses', ...finalStatuses]);
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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

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

      const ticketNo = (c.complaintNumber || (c as any).ticketNo || (c as any).TicketNo || '').toString().toLowerCase();
      const matchesSearch = searchQuery === '' || ticketNo.includes(searchQuery.toLowerCase());
      
      // If user is searching by ID, bypass all other filters
      if (searchQuery !== '') {
        return matchesSearch;
      }

      let matchesStatGroup = true;
      if (selectedStatGroup) {
        const group = getDashboardStatusGroup(fullStatusLabel);
        if (selectedStatGroup === 'Critical') {
          matchesStatGroup = group !== 'resolved' && group !== 'closed' && 
            ((c as any).isCritical === true || c.priority === 4 || (c as any).priority === 'Critical' || (c as any).priorityCode === 4);
        } else if (selectedStatGroup === 'Pending') {
          matchesStatGroup = group === 'new';
        } else if (selectedStatGroup === 'In Progress') {
          matchesStatGroup = group !== 'new' && group !== 'resolved' && group !== 'closed';
        } else if (selectedStatGroup === 'Resolved') {
          matchesStatGroup = group === 'resolved' || group === 'closed';
        }
      }

      return matchesStatus && matchesService && matchesStatGroup;
    });
  };

  const getDashboardStatusGroup = (statusLabel?: string) => {
    const compact = (statusLabel || '').toLowerCase().replace(/[\s_-]/g, '');
    if (compact === 'resolved') return 'resolved';
    if (compact === 'closed') return 'closed';
    if (compact === 'new' || compact === 'pending(unassigned)' || compact === 'pending') return 'new';
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
    
    // We get today's date for the right side
    const today = new Date();
    const dateOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    const dayOpts: Intl.DateTimeFormatOptions = { weekday: 'long' };
    
    return (
      <View style={styles.header}>
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <View style={{ flex: 1 }}>
            <Text style={styles.welcomeGreeting}>Welcome back,</Text>
            <Text style={styles.welcomeTitle}>{userEmail.split('@')[0]}!</Text>
          </View>
          <View style={styles.dateBlock}>
            <View style={styles.dateIconCircle}>
              <Text style={{ fontSize: 16 }}>📅</Text>
            </View>
            <View>
              <Text style={styles.dayText}>{today.toLocaleDateString('en-US', dayOpts)}</Text>
              <Text style={styles.dateText}>{today.toLocaleDateString('en-US', dateOpts)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.whiteContainer}>
          {/* Stat Cards Grid */}
          <View style={styles.overviewHeaderRow}>
            <Text style={styles.overviewTitle}>Overview</Text>
            <Text style={styles.overviewSubtitle}>Live Data</Text>
          </View>

          {stats && (
            <View style={styles.statsGrid}>
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => setSelectedStatGroup(selectedStatGroup === 'Critical' ? null : 'Critical')}
                style={[
                  styles.statCardCompact, 
                  { backgroundColor: '#fef2f2' },
                  selectedStatGroup === 'Critical' ? { borderWidth: 2, borderColor: '#ef4444', elevation: 5 } : { borderWidth: 2, borderColor: 'transparent' }
                ]}
              >
                <View style={[styles.statIconCircle, { backgroundColor: '#ef4444' }]}>
                  <Image source={{ uri: 'https://img.icons8.com/ios-filled/50/ffffff/high-importance.png' }} style={{ width: 14, height: 14 }} />
                </View>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValueCompact, { color: '#b91c1c' }]}>{calcStats.critical}</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={styles.statLabelCompact}>Critical</Text>
                <View style={[styles.statBottomLine, { backgroundColor: '#ef4444' }]} />
              </TouchableOpacity>

              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => setSelectedStatGroup(selectedStatGroup === 'Pending' ? null : 'Pending')}
                style={[
                  styles.statCardCompact, 
                  { backgroundColor: '#fff7ed' },
                  selectedStatGroup === 'Pending' ? { borderWidth: 2, borderColor: '#f97316', elevation: 5 } : { borderWidth: 2, borderColor: 'transparent' }
                ]}
              >
                <View style={[styles.statIconCircle, { backgroundColor: '#f97316' }]}>
                  <Image source={{ uri: 'https://img.icons8.com/ios-filled/50/ffffff/hourglass.png' }} style={{ width: 14, height: 14 }} />
                </View>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValueCompact, { color: '#c2410c' }]}>{calcStats.pending}</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={styles.statLabelCompact}>Pending</Text>
                <View style={[styles.statBottomLine, { backgroundColor: '#f97316' }]} />
              </TouchableOpacity>

              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => setSelectedStatGroup(selectedStatGroup === 'In Progress' ? null : 'In Progress')}
                style={[
                  styles.statCardCompact, 
                  { backgroundColor: '#faf5ff' },
                  selectedStatGroup === 'In Progress' ? { borderWidth: 2, borderColor: '#a855f7', elevation: 5 } : { borderWidth: 2, borderColor: 'transparent' }
                ]}
              >
                <View style={[styles.statIconCircle, { backgroundColor: '#a855f7' }]}>
                  <Image source={{ uri: 'https://img.icons8.com/ios-filled/50/ffffff/synchronize.png' }} style={{ width: 14, height: 14 }} />
                </View>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValueCompact, { color: '#7c3aed' }]}>{calcStats.inProgress}</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={styles.statLabelCompact}>In Progress</Text>
                <View style={[styles.statBottomLine, { backgroundColor: '#a855f7' }]} />
              </TouchableOpacity>

              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => setSelectedStatGroup(selectedStatGroup === 'Resolved' ? null : 'Resolved')}
                style={[
                  styles.statCardCompact, 
                  { backgroundColor: '#f0fdf4' },
                  selectedStatGroup === 'Resolved' ? { borderWidth: 2, borderColor: '#22c55e', elevation: 5 } : { borderWidth: 2, borderColor: 'transparent' }
                ]}
              >
                <View style={[styles.statIconCircle, { backgroundColor: '#22c55e' }]}>
                  <Image source={{ uri: 'https://img.icons8.com/ios-filled/50/ffffff/checkmark--v1.png' }} style={{ width: 14, height: 14 }} />
                </View>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValueCompact, { color: '#059669' }]}>{calcStats.resolved}</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={styles.statLabelCompact}>Resolved</Text>
                <View style={[styles.statBottomLine, { backgroundColor: '#22c55e' }]} />
              </TouchableOpacity>
            </View>
          )}

          {/* Search Bar */}
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrapper}>
              <Image source={{ uri: 'https://img.icons8.com/ios-filled/50/64748b/search--v1.png' }} style={{ width: 18, height: 18, marginRight: 10, opacity: 0.7 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by Ticket Number..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClearBtn}>
                  <Text style={{ fontSize: 12, color: '#ffffff', fontWeight: 'bold' }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Filter Row */}
          <View style={styles.filtersRow}>
            <TouchableOpacity
              ref={serviceBtnRef}
              style={styles.filterDropdownBtn}
              onPress={() => openDropdown('service', serviceBtnRef)}
            >
              <Text style={styles.filterDropdownText} numberOfLines={1}>{selectedService} ▾</Text>
            </TouchableOpacity>
            <TouchableOpacity
              ref={statusBtnRef}
              style={styles.filterDropdownBtn}
              onPress={() => openDropdown('status', statusBtnRef)}
            >
              <Text style={styles.filterDropdownText} numberOfLines={1}>{selectedStatus} ▾</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

    const renderComplaintItem = ({ item }: { item: CMSComplaintListItem }) => {
    const statusInfo = getStatusDisplay(item.status);
    const ticketNo = item.complaintNumber || (item as any).ticketNo || (item as any).TicketNo;
    const isCritical = (item as any).isCritical === true || item.priority === 4 || (item as any).priority === 'Critical' || (item as any).priorityCode === 4;
    
    // Extract assignee name if available
    const assigneeName = (item as any).currentAssigneeName || (item as any).CurrentAssigneeName || (item as any).assignedTo || (item as any).AssignedTo;
    
    // Customize badge text if it's assigned and we have an assignee name
    let badgeLabel = statusInfo.label;
    if ((item.status === 2 || item.status === 3 || item.status === 4 || item.status === 5) && assigneeName) {
      badgeLabel = `${statusInfo.label}: ${assigneeName}`;
    }

    return (
      <View style={[styles.complaintCard, { borderLeftWidth: 4, borderLeftColor: statusInfo.color }]}>
        <View style={styles.complaintHeader}>
          <View style={[styles.ticketBadge, { flexDirection: 'row', alignItems: 'center' }]}>
            <Text style={styles.ticketBadgeText}># {ticketNo}</Text>
            {isCritical && (
              <View style={{ marginLeft: 6, backgroundColor: '#fee2e2', borderRadius: 10, width: 16, height: 16, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: 'bold' }}>!</Text>
              </View>
            )}
          </View>
          <View style={[styles.badge, { backgroundColor: statusInfo.bg }]}>
            <Text style={[styles.badgeText, { color: statusInfo.color }]} numberOfLines={1}>{badgeLabel}</Text>
          </View>
        </View>
        <Text style={styles.complaintTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.complaintMeta}>
          <Text style={styles.complaintCategory} numberOfLines={1}>📁 {item.category}</Text>
          <Text style={styles.complaintDate}>📅 {formatDate(item.createdAt)}</Text>
        </View>
        <TouchableOpacity
          style={styles.viewButton}
          activeOpacity={0.8}
          onPress={() => {
            navigation.navigate('ComplaintDetail', { complaintNumber: ticketNo });
          }}
        >
          <Text style={styles.viewButtonText}>View Details  →</Text>
        </TouchableOpacity>
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
      <StatusBar barStyle="light-content" backgroundColor="#0B2046" />

      {/* Deep Blue Header Background */}
      <View style={styles.blueHeaderBg} />

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
                        if (activeDropdown === 'status') {
                          setSelectedStatus(option);
                          if (option !== 'All Statuses') {
                            const group = getDashboardStatusGroup(option);
                            if (group === 'new') setSelectedStatGroup('Pending');
                            else if (group === 'resolved' || group === 'closed') setSelectedStatGroup('Resolved');
                            else setSelectedStatGroup('In Progress');
                          } else {
                            setSelectedStatGroup(null);
                          }
                        }
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
          <View style={styles.brandContainer}>
            <Image source={require('../../assets/logos/cat20.png')} style={styles.headerLogoSmall} resizeMode="contain" />
            <View>
              <Text style={styles.brandTitle}>CAT2020 CMS</Text>
              <Text style={styles.brandSubtitle}>Complaint Management System</Text>
            </View>
          </View>
        </View>
      </View>

      <FlatList
        data={getFilteredComplaints()}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderComplaintItem}
        ListHeaderComponent={renderHeader()}
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
        <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
          <TouchableWithoutFeedback onPress={toggleDrawer}>
            <View style={styles.overlayBackground} />
          </TouchableWithoutFeedback>
        </Animated.View>
      )}

      <Animated.View style={[styles.drawerContainer, { transform: [{ translateX: slideAnim }] }]}>
        <SafeAreaView style={styles.drawerSafeArea} edges={['top', 'bottom']}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
            {/* Drawer Header (Deep Blue) */}
            <View style={styles.drawerHeaderBlue}>
              <View style={styles.drawerBrandRow}>
                <Image source={require('../../assets/logos/cat20.png')} style={styles.drawerLogoSmall} resizeMode="contain" />
                <View>
                  <Text style={styles.drawerBrandTitle}>CAT2020 CMS</Text>
                  <Text style={styles.drawerBrandSub}>Complaint Management System</Text>
                </View>
              </View>

              <View style={styles.drawerProfileRow}>
                <View style={styles.drawerProfileTextWrap}>
                  <Text style={styles.drawerProfileName}>{userEmail.split('@')[0] || 'Juan Dela Cruz'}</Text>
                  <Text style={styles.drawerProfileRole}>Department Head</Text>
                  <Text style={styles.drawerProfileOnline}>🟢 Online</Text>
                </View>
              </View>
            </View>

            {/* Drawer Links */}
            <View style={styles.drawerLinksContainer}>
              <TouchableOpacity style={styles.drawerLinkActive} onPress={toggleDrawer}>
                <Image source={{ uri: 'https://img.icons8.com/ios-filled/50/4338ca/dashboard.png' }} style={{ width: 20, height: 20, marginRight: 16 }} />
                <Text style={styles.drawerLinkTextActive}>Dashboard</Text>
              </TouchableOpacity>

              {/* User Management Section */}
              <Text style={styles.drawerSectionTitle}>User Management</Text>
              
              <TouchableOpacity 
                style={styles.drawerLinkInactive} 
                onPress={() => {
                  toggleDrawer();
                  navigation.navigate('Profile');
                }}
              >
                <Image source={{ uri: 'https://img.icons8.com/ios-filled/50/64748b/user-male-circle.png' }} style={{ width: 20, height: 20, marginRight: 16 }} />
                <Text style={styles.drawerLinkTextInactive}>My Profile</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.drawerLinkInactive} 
                onPress={() => {
                  toggleDrawer();
                  navigation.navigate('ChangePassword');
                }}
              >
                <Image source={{ uri: 'https://img.icons8.com/ios-filled/50/64748b/password.png' }} style={{ width: 20, height: 20, marginRight: 16 }} />
                <Text style={styles.drawerLinkTextInactive}>Change Password</Text>
              </TouchableOpacity>


              <View style={{ marginTop: 'auto' }}>
                <View style={styles.drawerDivider} />

                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                  <Image source={{ uri: 'https://img.icons8.com/ios-filled/50/ef4444/exit.png' }} style={{ width: 20, height: 20, marginRight: 16 }} />
                  <Text style={styles.logoutBtnText}>Logout</Text>
                </TouchableOpacity>
                
                <View style={{height: 40}} />
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const PRIMARY_BLUE = '#0B2046';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
  },
  
  // Header Adjustments
  blueHeaderBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 250,
    backgroundColor: PRIMARY_BLUE,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  menuButton: {
    marginRight: 16,
  },
  menuIcon: {
    fontSize: 24,
    color: '#ffffff',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogoSmall: {
    width: 48,
    height: 48,
    marginRight: 10,
    tintColor: '#ffffff',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  brandSubtitle: {
    fontSize: 10,
    color: '#93c5fd',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationBell: {
    position: 'relative',
    marginRight: 16,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: PRIMARY_BLUE,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  avatarContainer: {
    position: 'relative',
  },
  onlineDotMain: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    backgroundColor: '#10b981',
    borderRadius: 5,
    borderWidth: 2,
    borderColor: PRIMARY_BLUE,
  },
  
  // List Header Section
  listContent: {
    paddingBottom: 40,
  },
  header: {
    marginBottom: 0,
  },
  whiteContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
  },
  welcomeSection: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  welcomeGreeting: {
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  welcomeSubtitle: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  dateBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginLeft: 10,
  },
  dateIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  dateText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  dayText: {
    color: '#93c5fd',
    fontSize: 11,
  },

  overviewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  overviewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  overviewSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },

  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  statCardCompact: {
    flex: 1,
    borderRadius: 16,
    paddingTop: 12,
    paddingHorizontal: 8,
    paddingBottom: 16,
    marginHorizontal: 4,
    alignItems: 'flex-start',
  },
  statIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValueCompact: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 2,
    marginLeft: 2,
  },
  statLabelCompact: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginLeft: 2,
  },
  statBottomLine: {
    height: 3,
    width: 24,
    borderRadius: 2,
    marginTop: 8,
    marginLeft: 2,
  },
  statTrendText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
  },

  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  listHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#93c5fd',
  },
  
  searchRow: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
    padding: 0,
  },
  searchClearBtn: {
    backgroundColor: '#cbd5e1',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  filterDropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filterDropdownText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  
  // Dropdowns
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
    fontSize: 14,
    fontWeight: '500',
    color: '#4b5563',
    textAlign: 'center',
  },
  dropdownItemTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },

  // Complaint Card
  complaintCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  ticketBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ticketBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  complaintNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  complaintTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 10,
    lineHeight: 20,
  },
  complaintMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  complaintFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  complaintCategory: {
    fontSize: 11,
    color: '#64748b',
    flex: 1,
    marginRight: 8,
  },
  complaintDate: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
  },
  complaintActionRow: {
    marginTop: 12,
  },
  viewButton: {
    backgroundColor: '#0B2046',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
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
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },

  // ─── Custom Drawer Styles ───
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 10,
  },
  overlayBackground: {
    flex: 1,
  },
  drawerContainer: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#f8fafc',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 20,
  },
  drawerSafeArea: {
    flex: 1,
  },
  drawerHeaderBlue: {
    backgroundColor: PRIMARY_BLUE,
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  drawerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  drawerLogoSmall: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 24,
    marginRight: 12,
  },
  drawerBrandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  drawerBrandSub: {
    fontSize: 10,
    color: '#93c5fd',
  },
  drawerProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  drawerAvatarWrap: {
    position: 'relative',
    marginRight: 16,
  },
  onlineDotDrawer: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    backgroundColor: '#10b981',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: PRIMARY_BLUE,
  },
  drawerProfileTextWrap: {
    flex: 1,
  },
  drawerProfileName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  drawerProfileRole: {
    fontSize: 12,
    color: '#e2e8f0',
    marginBottom: 2,
  },
  drawerProfileOnline: {
    fontSize: 11,
    color: '#10b981',
    marginTop: 4,
    fontWeight: '600',
  },
  drawerLinksContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  drawerSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 12,
  },
  drawerLinkActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0e7ff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  drawerLinkInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  drawerLinkIconActive: {
    fontSize: 20,
    marginRight: 16,
  },
  drawerLinkIcon: {
    fontSize: 20,
    marginRight: 16,
    opacity: 0.8,
  },
  drawerLinkTextActive: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4338ca',
  },
  drawerLinkTextInactive: {
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
  },
  drawerBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  drawerBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  drawerDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
    marginHorizontal: 8,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  logoutIcon: {
    fontSize: 20,
    marginRight: 16,
  },
  logoutBtnText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '700',
  },
});
