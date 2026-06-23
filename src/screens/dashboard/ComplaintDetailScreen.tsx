import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Linking,
  Image,
  Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { DashboardService, CMSComplaintDetail } from '../../services/DashboardService';

// Helpers
function getStatusDisplay(status: number): { label: string; color: string; bg: string } {
  switch (status) {
    case 1: return { label: 'New', color: '#b91c1c', bg: '#fef2f2' };
    case 2:
    case 3:
    case 4:
    case 5: return { label: 'Assigned', color: '#1d4ed8', bg: '#eff6ff' };
    case 6: return { label: 'Resolved', color: '#15803d', bg: '#f0fdf4' };
    case 7: return { label: 'Closed', color: '#4b5563', bg: '#f3f4f6' };
    case 8: return { label: 'In Progress', color: '#b45309', bg: '#fffbeb' };
    case 9: return { label: 'Awaiting Info', color: '#a21caf', bg: '#fdf4ff' };
    default: return { label: 'Unknown', color: '#4b5563', bg: '#f3f4f6' };
  }
}

function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 1: return 'Low';
    case 2: return 'Medium';
    case 3: return 'High';
    case 4: return 'Critical';
    default: return 'Medium';
  }
}

function formatDate(dateString?: string) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ComplaintDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { complaintNumber } = route.params || {};

  const [isLoading, setIsLoading] = useState(true);
  const [complaint, setComplaint] = useState<CMSComplaintDetail | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (complaintNumber) {
      fetchDetails(complaintNumber);
    } else {
      setIsLoading(false);
    }
  }, [complaintNumber]);

  const fetchDetails = async (ticketNo: string) => {
    try {
      setIsLoading(true);
      const data = await DashboardService.getComplaintByNumber(ticketNo);
      setComplaint(data);
    } catch (error) {
      console.error('Failed to load complaint details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading details...</Text>
      </SafeAreaView>
    );
  }

  if (!complaint) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.errorText}>Complaint not found.</Text>
        <TouchableOpacity style={styles.backButtonCenter} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const statusInfo = getStatusDisplay(complaint.status);
  
  // Build unified timeline
  const unifiedTimeline = [
    ...(complaint.statusHistory || []).map(h => ({
      id: `s_${h.id}`,
      kind: 'status',
      date: h.changedAt,
      title: `Status changed to ${getStatusDisplay(h.toStatus).label}`,
      actor: h.changedBy,
      details: h.remarks,
      attachments: h.attachments,
    })),
    ...(complaint.comments || []).map(c => ({
      id: `c_${c.id}`,
      kind: 'comment',
      date: c.date,
      title: 'Added a comment',
      actor: c.author,
      details: c.text,
      attachments: c.attachments,
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'timeline', label: `Timeline ${unifiedTimeline.length}` },
    { id: 'comments', label: `Comments ${complaint.comments?.length || 0}` },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>COMPLAINT DETAILS</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Title Area */}
        <View style={styles.titleSection}>
          <Text style={styles.complaintTitle}>{complaint.title}</Text>
          <View style={styles.subtitleRow}>
            <View style={styles.numberBadge}>
              <Text style={styles.numberBadgeText}>{complaint.complaintNumber}</Text>
            </View>
            <Text style={styles.updatedText}>Created on {formatDate(complaint.createdAt)}</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>CURRENTLY</Text>
              <View style={styles.statValueRow}>
                <Text style={styles.statIcon}>👤</Text>
                <Text style={[styles.statValue, { color: statusInfo.color }]}>{complaint.assignedTo || statusInfo.label}</Text>
              </View>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>CATEGORY</Text>
              <View style={styles.statValueRow}>
                <Text style={styles.statIcon}>📁</Text>
                <Text style={styles.statValue} numberOfLines={1}>{complaint.category}</Text>
              </View>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>PRIORITY</Text>
              <View style={styles.statValueRow}>
                <Text style={styles.statIcon}>🚩</Text>
                <View style={styles.priorityBadge}>
                  <Text style={styles.priorityText}>{getPriorityLabel(complaint.priority)}</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>DUE DATE</Text>
              <View style={styles.statValueRow}>
                <Text style={styles.statIcon}>📅</Text>
                <Text style={styles.statValue}>{formatDate(complaint.resolutionDueAt)}</Text>
              </View>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>TIME ELAPSED</Text>
              <View style={styles.statValueRow}>
                <Text style={styles.statIcon}>⏳</Text>
                <Text style={styles.statValue}>-</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
            {tabs.map(tab => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabButton, activeTab === tab.id && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Tab Content - Overview */}
        {activeTab === 'overview' && (
          <View style={styles.tabContent}>
            
            {/* Description Card */}
            <View style={styles.card}>
              <View style={[styles.cardHeader, { backgroundColor: '#f0fdf4' }]}>
                <Text style={[styles.cardHeaderTitle, { color: '#166534' }]}>Complaint Description</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.descriptionText}>{complaint.description || 'No description provided.'}</Text>
              </View>
            </View>

            {/* Reporter Info Card */}
            <View style={styles.card}>
              <View style={[styles.cardHeader, { backgroundColor: '#eff6ff' }]}>
                <Text style={[styles.cardHeaderTitle, { color: '#1e40af' }]}>Reporter Information</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.sectionSubtitle}>IDENTITY</Text>
                <View style={styles.infoRow}>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>FULL NAME</Text>
                    <Text style={styles.infoValue}>{complaint.reporterName || 'N/A'}</Text>
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>NIC</Text>
                    <Text style={styles.infoValue}>{complaint.reporterNic || 'N/A'}</Text>
                  </View>
                </View>

                <View style={styles.infoDivider} />
                
                <Text style={styles.sectionSubtitle}>CONTACT</Text>
                <View style={styles.infoRow}>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>MOBILE</Text>
                    <Text style={styles.infoValue}>{complaint.reporterMobile || 'N/A'}</Text>
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>EMAIL</Text>
                    <Text style={styles.infoValue}>{complaint.reporterEmail || 'N/A'}</Text>
                  </View>
                </View>
                <View style={[styles.infoRow, { marginTop: 16 }]}>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>ADDRESS</Text>
                    <Text style={styles.infoValue}>{complaint.reporterAddress || 'N/A'}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Attachments Card */}
            <View style={styles.card}>
              <View style={[styles.cardHeader, { backgroundColor: '#f3f4f6' }]}>
                <Text style={[styles.cardHeaderTitle, { color: '#374151' }]}>
                  Complaint Attachments ({complaint.attachments?.length || 0})
                </Text>
              </View>
              <View style={styles.cardBody}>
                {complaint.attachments && complaint.attachments.length > 0 ? (
                  complaint.attachments.map((att: any, idx: number) => {
                    const isImg = att.url && /\.(jpeg|jpg|gif|png|webp|bmp)$/i.test(att.url);
                    return (
                      <TouchableOpacity 
                        key={idx} 
                        style={styles.attachmentItem}
                        activeOpacity={0.7}
                        onPress={() => {
                          if (att.url) {
                            if (isImg) {
                              setSelectedImage(att.url);
                            } else {
                              Linking.openURL(att.url).catch(err => console.error("Couldn't load page", err));
                            }
                          }
                        }}
                      >
                        {isImg ? (
                          <Image source={{ uri: att.url }} style={styles.attachmentPreview} resizeMode="cover" />
                        ) : (
                          <View style={styles.attachmentIcon}>
                            <Text style={styles.attachmentIconText}>📎</Text>
                          </View>
                        )}
                        <Text style={styles.attachmentName} numberOfLines={1}>
                          {att.fileName || `Attachment ${idx + 1}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>No attachments uploaded.</Text>
                )}
              </View>
            </View>

          </View>
        )}

        {/* Tab Content - Timeline */}
        {activeTab === 'timeline' && (
          <View style={styles.tabContent}>
            {unifiedTimeline.length > 0 ? (
              unifiedTimeline.map((entry: any, idx: number) => (
                <View key={entry.id} style={styles.tlRow}>
                  {/* Track */}
                  <View style={styles.tlTrack}>
                    <View style={[styles.tlDot, entry.kind === 'comment' ? {backgroundColor: '#8b5cf6'} : {}]} />
                    {idx < unifiedTimeline.length - 1 && <View style={styles.tlLine} />}
                  </View>

                  {/* Card */}
                  <View style={styles.tlCard}>
                    <View style={styles.tlCardHeader}>
                      <View style={styles.tlCardHeaderLeft}>
                        <View style={[styles.tlBadge, entry.kind === 'comment' ? {backgroundColor: '#ede9fe'} : {}]}>
                          <Text style={[styles.tlBadgeText, entry.kind === 'comment' ? {color: '#6d28d9'} : {}]}>
                            {entry.kind === 'status' ? 'Status update' : 'Comment'}
                          </Text>
                        </View>
                        <Text style={styles.tlCardTitle}>{entry.title}</Text>
                      </View>
                      <Text style={styles.tlCardTime}>{formatDate(entry.date)}</Text>
                    </View>

                    <View style={styles.tlActorRow}>
                      <View style={styles.tlAvatar}>
                        <Text style={styles.tlAvatarText}>{entry.actor ? entry.actor.charAt(0).toUpperCase() : '?'}</Text>
                      </View>
                      <Text style={styles.tlActorName}>{entry.actor}</Text>
                    </View>

                    {entry.details ? (
                      entry.kind === 'status' ? (
                        <View style={styles.tlMinute}>
                          <View style={styles.tlMinuteHeader}>
                            <Text style={styles.tlMinuteLabel}>📝 Minute</Text>
                          </View>
                          <Text style={styles.tlMinuteText}>{entry.details}</Text>
                        </View>
                      ) : (
                        <Text style={styles.tlNoteText}>{entry.details}</Text>
                      )
                    ) : null}

                    {entry.attachments && entry.attachments.length > 0 && (
                      <View style={styles.tlAttachments}>
                        {entry.attachments.map((att: any, idx: number) => {
                          const isImg = att.url && /\.(jpeg|jpg|gif|png|webp|bmp)$/i.test(att.url);
                          return (
                            <TouchableOpacity 
                              key={idx} 
                              style={styles.tlAttachmentItem}
                              activeOpacity={0.7}
                              onPress={() => {
                                if (att.url) {
                                  if (isImg) {
                                    setSelectedImage(att.url);
                                  } else {
                                    Linking.openURL(att.url).catch(err => console.error("Couldn't load page", err));
                                  }
                                }
                              }}
                            >
                              {isImg ? (
                                <Image source={{ uri: att.url }} style={styles.tlAttachmentPreview} resizeMode="cover" />
                              ) : (
                                <View style={styles.tlAttachmentIcon}>
                                  <Text style={{fontSize: 12}}>📎</Text>
                                </View>
                              )}
                              <Text style={styles.tlAttachmentName} numberOfLines={1}>
                                {att.fileName || `Attachment ${idx + 1}`}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyText}>No timeline history available.</Text>
              </View>
            )}
          </View>
        )}

        {/* Tab Content - Comments */}
        {activeTab === 'comments' && (
          <View style={styles.tabContent}>
            {complaint.comments && complaint.comments.length > 0 ? (
              complaint.comments.map((comment: any, idx: number) => (
                <View key={idx} style={styles.commentCard}>
                  <View style={styles.commentHeader}>
                    <View style={styles.commentAvatar}>
                      <Text style={styles.commentAvatarText}>{comment.author ? comment.author.charAt(0).toUpperCase() : 'U'}</Text>
                    </View>
                    <View style={styles.commentAuthorInfo}>
                      <Text style={styles.commentAuthor}>{comment.author}</Text>
                      <Text style={styles.commentDate}>{formatDate(comment.date)}</Text>
                    </View>
                  </View>
                  <Text style={styles.commentText}>{comment.text}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyText}>No comments available.</Text>
              </View>
            )}
          </View>
        )}

        {/* Tab Content - Placeholder for others */}
        {activeTab !== 'overview' && activeTab !== 'timeline' && activeTab !== 'comments' && (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyText}>This section is under development.</Text>
          </View>
        )}

      </ScrollView>

      {/* Image Preview Modal */}
      <Modal visible={!!selectedImage} transparent={true} animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity style={styles.imageModalCloseBtn} onPress={() => setSelectedImage(null)}>
            <Text style={styles.imageModalCloseText}>✕</Text>
          </TouchableOpacity>
          <Image source={{ uri: selectedImage || undefined }} style={styles.imageModalImage} resizeMode="contain" />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

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
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    marginBottom: 16,
  },
  backButtonCenter: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#2563eb',
    fontWeight: '600',
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backIcon: {
    fontSize: 24,
    color: '#111827',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  titleSection: {
    marginBottom: 20,
  },
  complaintTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  numberBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  numberBadgeText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700',
  },
  updatedText: {
    fontSize: 13,
    color: '#6b7280',
  },
  statsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    marginBottom: 20,
    overflow: 'hidden',
  },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
  },
  statsDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 12,
    marginRight: 6,
    opacity: 0.7,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  priorityBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 20,
  },
  tabsScroll: {
    flexDirection: 'row',
  },
  tabButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#2563eb',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#2563eb',
  },
  tabContent: {
    gap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  cardBody: {
    padding: 16,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#4b5563',
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 1,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 16,
  },
  emptyStateContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  attachmentIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  attachmentIconText: {
    fontSize: 16,
  },
  attachmentPreview: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: '#e5e7eb',
  },
  attachmentName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  tlRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  tlTrack: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  tlDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
    marginTop: 16,
    zIndex: 2,
  },
  tlLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e5e7eb',
    position: 'absolute',
    top: 26,
    bottom: -16,
    zIndex: 1,
  },
  tlCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
  },
  tlCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tlCardHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  tlBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  tlBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1e40af',
    textTransform: 'uppercase',
  },
  tlCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  tlCardTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  tlActorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tlAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  tlAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4b5563',
  },
  tlActorName: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  tlMinute: {
    backgroundColor: '#f9fafb',
    borderLeftWidth: 3,
    borderLeftColor: '#d1d5db',
    padding: 12,
    borderRadius: 6,
  },
  tlMinuteHeader: {
    marginBottom: 4,
  },
  tlMinuteLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  tlMinuteText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  tlNoteText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginTop: 4,
  },
  tlAttachments: {
    marginTop: 12,
  },
  tlAttachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  tlAttachmentPreview: {
    width: 28,
    height: 28,
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: '#e5e7eb',
  },
  tlAttachmentIcon: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  tlAttachmentName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#1f2937',
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  imageModalCloseText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  imageModalImage: {
    width: '100%',
    height: '100%',
  },
  commentCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  commentAvatarText: {
    color: '#1e40af',
    fontWeight: '700',
    fontSize: 16,
  },
  commentAuthorInfo: {
    flex: 1,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  commentDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
});
