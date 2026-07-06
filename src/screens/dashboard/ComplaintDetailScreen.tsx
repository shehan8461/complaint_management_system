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
  TextInput,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { DashboardService, CMSComplaintDetail, CMSUser, CMSDepartment } from '../../services/DashboardService';
import { AuthService } from '../../services/AuthService';

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

  // Assignment Feature State
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [departments, setDepartments] = useState<CMSDepartment[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [allDepartmentHeads, setAllDepartmentHeads] = useState<CMSUser[]>([]);
  const [selectedDeptHead, setSelectedDeptHead] = useState<CMSUser | null>(null);
  
  const [resolutionDate, setResolutionDate] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [assignRemarks, setAssignRemarks] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isReassignment, setIsReassignment] = useState(false);

  // Review & Resolve State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [activeReviewTab, setActiveReviewTab] = useState<'approve'|'disapprove'>('approve');
  const [reviewRemarks, setReviewRemarks] = useState<string>('');
  const [isReviewing, setIsReviewing] = useState(false);

  // Add Comment State
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentAttachments, setNewCommentAttachments] = useState<{file: any, description: string}[]>([]);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Edit Comment State
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [isUpdatingComment, setIsUpdatingComment] = useState(false);

  // Contact Reporter State
  const [newContactMessage, setNewContactMessage] = useState('');
  const [newContactAttachment, setNewContactAttachment] = useState<any>(null);
  const [notifyByEmail, setNotifyByEmail] = useState(false);
  const [notifyBySms, setNotifyBySms] = useState(false);
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);

  const minuteSuggestions = [
    'Kindly attend to this urgently.',
    'Immediate attention is required.',
    'Please take the required actions.',
    'Please review and proceed accordingly.',
    'Necessary action to be taken promptly.',
  ];

  useEffect(() => {
    checkAdminStatus();
    if (complaintNumber) {
      fetchDetails(complaintNumber);
    } else {
      setIsLoading(false);
    }
  }, [complaintNumber]);

  const checkAdminStatus = async () => {
    const user = await AuthService.getMe();
    if (user) {
      setCurrentUserId(user.id);
      setIsAdmin(!!(user.roles?.includes('9') || user.roles?.includes(9)));
    }
  };

  const fetchAssignmentData = async () => {
    try {
      const [users, depts] = await Promise.all([
        DashboardService.getCmsUsers(),
        DashboardService.getDepartments()
      ]);
      
      setDepartments(depts);
      // Filter for Department Head (roleId = 10)
      const heads = users.filter(u => Number(u.roleId) === 10);
      setAllDepartmentHeads(heads);
      
      // Default resolution date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setResolutionDate(tomorrow.toISOString().slice(0, 10));
      
    } catch (error) {
      console.error('Failed to load assignment data', error);
      Alert.alert('Error', 'Could not load assignment data');
    }
  };

  const handleOpenAssign = () => {
    setShowAssignModal(true);
    setSelectedDeptId(null);
    setSelectedDeptHead(null);
    setAssignRemarks('');
    fetchAssignmentData();
  };

  const handleOpenReassign = () => {
    setIsReassignment(true);
    setShowAssignModal(true);
    setAssignRemarks('');
    fetchAssignmentData();
  };

  const sanitizeFileName = (fileName: string) => {
    if (!fileName) return 'attachment_file';
    const parts = fileName.split('.');
    const ext = parts.length > 1 ? '.' + parts.pop() : '';
    let base = parts.join('.');
    
    // If name is extremely long, truncate to last 40 characters (likely the original name without prefixes)
    if (base.length > 40) {
      base = base.substring(base.length - 40);
    }
    // Remove any leading underscores that might be left over from truncated GUIDs
    base = base.replace(/^_+/, '');
    if (!base) base = 'attachment';
    return base + ext;
  };

  const handlePickDocument = async () => {
    try {
      const res = await pick({
        type: [types.allFiles],
        allowMultiSelection: true,
      });
      if (res && res.length > 0) {
        const newAtts = res.map(file => ({ 
          file: { ...file, name: sanitizeFileName(file.name || '') }, 
          description: '' 
        }));
        setNewCommentAttachments(prev => [...prev, ...newAtts]);
      }
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        // User cancelled, do nothing
      } else {
        console.error('Unknown Error picking file:', err);
      }
    }
  };

  const handlePickContactDocument = async () => {
    try {
      const res = await pick({
        type: [types.allFiles],
        allowMultiSelection: false,
      });
      if (res && res.length > 0) {
        setNewContactAttachment(res[0]);
      }
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        // User cancelled, do nothing
      } else {
        console.error('Unknown Error picking file:', err);
      }
    }
  };

  const handleAddComment = async () => {
    if (!newCommentText.trim() && newCommentAttachments.length === 0) return;
    
    try {
      setIsSubmittingComment(true);
      let attachments: any[] = [];
      
      for (const att of newCommentAttachments) {
        const safeName = sanitizeFileName(att.file.name || 'attachment_file');
        const uploadResult = await DashboardService.uploadComplaintAttachment({
          uri: att.file.uri,
          type: att.file.type || 'application/octet-stream',
          name: safeName,
        }, complaint!.id);
        
        attachments.push({
          fileName: safeName,
          storedFileName: uploadResult.storedFileName || uploadResult.fileName || uploadResult.data?.storedFileName || uploadResult.data?.fileName,
          contentType: att.file.type,
          fileSizeInBytes: att.file.size || 0,
          storagePath: uploadResult.storagePath || uploadResult.data?.storagePath || null,
          description: att.description
        });
      }

      await DashboardService.addComment(complaint!.id, {
        commentText: newCommentText.trim(),
        visibility: 1, // Official visibility
        attachments,
      });

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Comment added successfully.'
      });
      setNewCommentText('');
      setNewCommentAttachments([]);
      if (complaintNumber) fetchDetails(complaintNumber);
    } catch (error: any) {
      console.error('Failed to add comment:', error);
      const errMsg = error?.response?.data?.message || error?.response?.data || error.message;
      Alert.alert('Error', `Failed to add comment: ${typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg}`);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleEditComment = (comment: any) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.text);
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleUpdateComment = async (commentId: number) => {
    if (!editingCommentText.trim()) {
      Alert.alert('Validation', 'Comment text cannot be empty.');
      return;
    }
    
    try {
      setIsUpdatingComment(true);
      await DashboardService.updateComment(complaint!.id, commentId, {
        commentText: editingCommentText.trim()
      });
      
      setEditingCommentId(null);
      setEditingCommentText('');
      if (complaintNumber) fetchDetails(complaintNumber);
    } catch (error: any) {
      console.error('Failed to update comment:', error);
      const errMsg = error?.response?.data?.message || error?.response?.data || error.message;
      Alert.alert('Error', `Failed to update comment: ${typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg}`);
    } finally {
      setIsUpdatingComment(false);
    }
  };

  const handleDeleteComplaintAttachment = (attachmentId: number, fileName: string) => {
    Alert.alert(
      'Delete Attachment',
      `Are you sure you want to remove "${fileName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await DashboardService.deleteComplaintAttachment(complaint!.id, attachmentId);
              if (complaintNumber) fetchDetails(complaintNumber);
            } catch (error: any) {
              console.error('Failed to delete attachment:', error);
              const errMsg = error?.response?.data?.message || error?.response?.data || error.message;
              Alert.alert('Error', `Failed to delete attachment: ${typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg}`);
            }
          }
        }
      ]
    );
  };

  const handleDeleteCommentAttachment = (commentId: number, attachmentId: number, fileName: string) => {
    Alert.alert(
      'Delete Attachment',
      `Are you sure you want to remove "${fileName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await DashboardService.deleteCommentAttachment(complaint!.id, commentId, attachmentId);
              if (complaintNumber) fetchDetails(complaintNumber);
            } catch (error: any) {
              console.error('Failed to delete attachment:', error);
              const errMsg = error?.response?.data?.message || error?.response?.data || error.message;
              Alert.alert('Error', `Failed to delete attachment: ${typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg}`);
            }
          }
        }
      ]
    );
  };

  const handleAddContactMessage = async () => {
    if (!newContactMessage.trim() && !newContactAttachment) return;
    try {
      setIsSubmittingContact(true);
      let attachments: any[] = [];
      
      if (newContactAttachment) {
        const uploadResult = await DashboardService.uploadComplaintAttachment({
          uri: newContactAttachment.uri,
          type: newContactAttachment.type || 'application/octet-stream',
          name: newContactAttachment.name || 'attachment_file',
        }, complaint!.id);
        
        attachments.push({
          fileName: newContactAttachment.name,
          storedFileName: uploadResult.storedFileName || uploadResult.fileName || uploadResult.data?.storedFileName || uploadResult.data?.fileName,
          contentType: newContactAttachment.type,
          fileSizeInBytes: newContactAttachment.size || 0,
          storagePath: uploadResult.storagePath || uploadResult.data?.storagePath || null,
        });
      }

      await DashboardService.addContactReporterMessage(complaint!.id, {
        messageText: newContactMessage.trim(),
        notifyByEmail,
        notifyBySms,
        attachments,
      });

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Message sent successfully.'
      });
      setNewContactMessage('');
      setNewContactAttachment(null);
      setNotifyByEmail(false);
      setNotifyBySms(false);
      if (complaintNumber) fetchDetails(complaintNumber);
    } catch (error: any) {
      console.error('Failed to send message:', error);
      const errMsg = error?.response?.data?.message || error?.response?.data || error.message;
      Alert.alert('Error', `Failed to send message: ${typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg}`);
    } finally {
      setIsSubmittingContact(false);
    }
  };

  const handleAssignSubmit = async () => {
    if (!selectedDeptId) {
      Alert.alert('Validation', 'Please select a Department.');
      return;
    }
    if (!selectedDeptHead) {
      Alert.alert('Validation', 'Please select a Department Head.');
      return;
    }
    if (!resolutionDate) {
      Alert.alert('Validation', 'Completion Due Date is required.');
      return;
    }
    if (!assignRemarks || assignRemarks.trim().length < 10) {
      Alert.alert('Validation', 'Minute is required and must be at least 10 characters.');
      return;
    }

    // Basic date validation
    if (!/^\d{4}-\d{2}-\d{2}$/.test(resolutionDate)) {
      Alert.alert('Validation', 'Please enter a valid date in YYYY-MM-DD format.');
      return;
    }

    try {
      setIsAssigning(true);
      await DashboardService.assignComplaint(complaint!.id, {
        toUserId: selectedDeptHead.id,
        toUserName: selectedDeptHead.nameWithInitials || selectedDeptHead.username,
        toRole: 5, // Department Head Assignment Role
        toOrgUnitId: selectedDeptId,
        remarks: assignRemarks,
        isReassignment: isReassignment,
        resolutionDueAt: resolutionDate + 'T23:59:59',
      });
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: `Complaint successfully ${isReassignment ? 'reassigned' : 'assigned'} to Department Head.`
      });
      setShowAssignModal(false);
      
      // Refresh complaint details
      fetchDetails(complaintNumber);
    } catch (error: any) {
      console.error('Assign error:', error);
      Alert.alert('Assignment Failed', error?.message || 'Could not assign complaint.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleReviewSubmit = async () => {
    if (!reviewRemarks || reviewRemarks.trim().length < 5) {
      Alert.alert('Validation', 'Remarks are required (min 5 characters).');
      return;
    }

    try {
      setIsReviewing(true);
      
      if (activeReviewTab === 'approve') {
        await DashboardService.updateComplaintStatus(complaint!.id, {
          status: 6, // Resolved
          remarks: reviewRemarks,
          resolutionSummary: reviewRemarks
        });
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Complaint successfully reviewed and resolved.'
        });
      } else {
        // Disapprove Logic
        const assignments = complaint?.assignments || [];
        const latestDeptHeadAssignment = [...assignments]
          .reverse()
          .find((item: any) => [5, 10].includes(Number(item.toRole || item.ToRole)) && Number(item.toUserId || item.ToUserId) > 0);
          
        if (!latestDeptHeadAssignment) {
           Alert.alert('Error', 'Failed to disapprove: no department head assignment found to route back to.');
           setIsReviewing(false);
           return;
        }
        
        await DashboardService.assignComplaint(complaint!.id, {
          toUserId: Number(latestDeptHeadAssignment.toUserId || latestDeptHeadAssignment.ToUserId),
          toUserName: latestDeptHeadAssignment.toUserName || latestDeptHeadAssignment.ToUserName || `Department Head`,
          toRole: 5,
          remarks: `Admin disapproved: ${reviewRemarks}`,
          isReassignment: true,
        });
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Complaint disapproved and returned to Department Head.'
        });
      }
      
      setShowReviewModal(false);
      
      // Refresh complaint details
      fetchDetails(complaintNumber);
    } catch (error: any) {
      console.error('Review error:', error);
      Alert.alert('Review Failed', error?.message || 'Could not resolve complaint.');
    } finally {
      setIsReviewing(false);
    }
  };

  const fetchDetails = async (ticketNo: string) => {
    try {
      setIsLoading(true);
      const data = await DashboardService.getComplaintByNumber(ticketNo);
      setComplaint(data);
      if (data) {
        setNotifyByEmail(!!data.reporterEmail);
        setNotifyBySms(!!data.reporterMobile);
      }
    } catch (error) {
      console.error('Failed to load complaint details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0B2046" />
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

  // Sort comments by ID desc
  const sortedComments = [...(complaint.comments || [])].sort((a, b) => b.id - a.id);

  // Extract all attachments from all comments
  const commentAttachments = (complaint.comments || []).flatMap(c => c.attachments || []);

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
    { id: 'timeline', label: `Timeline (${unifiedTimeline.length})` },
    { id: 'comments', label: `Comments (${complaint.comments?.length || 0})` },
    { id: 'contactReporter', label: `Contact (${complaint.contactReporterMessages?.length || 0})` },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B2046" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>COMPLAINT DETAILS</Text>
        </View>
      </View>

      <View style={styles.mainContent}>
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
                <Image source={{ uri: 'https://img.icons8.com/ios-filled/50/0B2046/user.png' }} style={{ width: 16, height: 16, marginRight: 6 }} />
                <Text style={[styles.statValue, { color: statusInfo.color }]}>{complaint.assignedTo || statusInfo.label}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, activeTab === tab.id && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.7}
            >
              <Text 
                style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]} 
                numberOfLines={1} 
                adjustsFontSizeToFit 
                minimumFontScale={0.75}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content - Overview */}
        {activeTab === 'overview' && (
          <View style={styles.tabContent}>
            
            {/* Description Card */}
            <View style={styles.card}>
              <View style={[styles.cardHeader, { flexDirection: 'row', alignItems: 'center' }]}>
                <Image source={{ uri: 'https://img.icons8.com/ios-filled/50/0B2046/document.png' }} style={{ width: 18, height: 18, marginRight: 8 }} />
                <Text style={styles.cardHeaderTitle}>Description</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.descriptionText}>{complaint.description || 'No description provided.'}</Text>
              </View>
            </View>

            {/* Reporter Info Card */}
            <View style={styles.card}>
              <View style={[styles.cardHeader, { flexDirection: 'row', alignItems: 'center' }]}>
                <Image source={{ uri: 'https://img.icons8.com/ios-filled/50/0B2046/user.png' }} style={{ width: 18, height: 18, marginRight: 8 }} />
                <Text style={styles.cardHeaderTitle}>Reporter Information</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.sectionSubtitle}>IDENTITY</Text>
                <View style={styles.infoRow}>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>FULL NAME</Text>
                    <Text style={styles.infoValue}>{complaint.reporterName || '-'}</Text>
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>NIC</Text>
                    <Text style={styles.infoValue}>{complaint.reporterNic || '-'}</Text>
                  </View>
                </View>

                <View style={styles.infoDivider} />
                
                <Text style={styles.sectionSubtitle}>CONTACT</Text>
                <View style={styles.infoRow}>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>MOBILE</Text>
                    <Text style={styles.infoValue}>{complaint.reporterMobile || '-'}</Text>
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>EMAIL</Text>
                    <Text style={styles.infoValue}>{complaint.reporterEmail || '-'}</Text>
                  </View>
                </View>
                <View style={[styles.infoRow, { marginTop: 16 }]}>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>ADDRESS</Text>
                    <Text style={styles.infoValue}>{complaint.reporterAddress || '-'}</Text>
                  </View>
                </View>
                
                {(complaint.reporterMobile || complaint.reporterEmail) && (
                  <View style={{ marginTop: 24, flexDirection: 'row', justifyContent: 'space-between' }}>
                    {complaint.reporterMobile ? (
                      <TouchableOpacity 
                        style={[styles.submitAssignBtn, { flex: 1, backgroundColor: '#0B2046', paddingVertical: 12, borderRadius: 8, marginRight: complaint.reporterEmail ? 8 : 0 }]}
                        onPress={() => Linking.openURL(`tel:${complaint.reporterMobile}`)}
                      >
                        <Text style={[styles.submitAssignBtnText, { fontSize: 13 }]}>📞 Call Reporter</Text>
                      </TouchableOpacity>
                    ) : null}
                    {complaint.reporterEmail ? (
                      <TouchableOpacity 
                        style={[styles.submitAssignBtn, { flex: 1, backgroundColor: '#0ea5e9', paddingVertical: 12, borderRadius: 8, marginLeft: complaint.reporterMobile ? 8 : 0 }]}
                        onPress={() => Linking.openURL(`mailto:${complaint.reporterEmail}`)}
                      >
                        <Text style={[styles.submitAssignBtnText, { fontSize: 13 }]}>✉️ Email Reporter</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                )}
              </View>
            </View>

            {/* Comments Card */}
            <View style={styles.card}>
              <View style={[styles.cardHeader, { flexDirection: 'row', alignItems: 'center' }]}>
                <Image source={{ uri: 'https://img.icons8.com/ios-filled/50/0B2046/speech-bubble-with-dots.png' }} style={{ width: 18, height: 18, marginRight: 8 }} />
                <Text style={styles.cardHeaderTitle}>Comments ({complaint.comments?.length || 0})</Text>
              </View>
              <View style={[styles.cardBody, { backgroundColor: '#f9fafb' }]}>
                {complaint.comments && complaint.comments.length > 0 ? (
                  complaint.comments.map((comment: any, idx: number) => (
                    <View key={idx} style={[styles.commentCard, { marginBottom: idx === complaint.comments.length - 1 ? 0 : 12 }]}>
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
                  <Text style={styles.emptyText}>No comments available.</Text>
                )}
              </View>
            </View>

            {/* Attachments Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardHeaderTitle}>
                  📎 Attachments ({complaint.attachments?.length || 0})
                </Text>
              </View>
              <View style={styles.cardBody}>
                {complaint.attachments && complaint.attachments.length > 0 ? (
                  complaint.attachments.map((att: any, idx: number) => {
                    const isImg = att.url && /\.(jpeg|jpg|gif|png|webp|bmp)$/i.test(att.url);
                    return (
                      <View key={idx} style={[styles.attachmentItem, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                        <TouchableOpacity 
                          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
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
                          <View style={{ flex: 1, justifyContent: 'center' }}>
                            <Text style={styles.attachmentName} numberOfLines={1}>
                              {att.fileName || `Attachment ${idx + 1}`}
                            </Text>
                            {!!att.description && (
                              <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }} numberOfLines={2}>
                                {att.description}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                        {isAdmin && (
                          <TouchableOpacity 
                            style={styles.deleteAttachmentBtn} 
                            onPress={() => handleDeleteComplaintAttachment(att.id, att.fileName || `Attachment ${idx + 1}`)}
                          >
                            <Text style={styles.deleteAttachmentIcon}>🗑️</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>No attachments uploaded.</Text>
                )}
              </View>
            </View>

            {/* Comment Attachments Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardHeaderTitle}>
                  📎 Comment Attachments ({commentAttachments.length})
                </Text>
              </View>
              <View style={styles.cardBody}>
                {commentAttachments.length > 0 ? (
                  commentAttachments.map((att: any, idx: number) => {
                    const isImg = att.url && /\.(jpeg|jpg|gif|png|webp|bmp)$/i.test(att.url);
                    return (
                      <TouchableOpacity 
                        key={`cmt_att_${idx}`} 
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
                  <Text style={styles.emptyText}>No comment attachments uploaded.</Text>
                )}
              </View>
            </View>

            {/* Action Row for Assignments */}
            {(isAdmin && (complaint.status === 1 || complaint.status === 5)) && (
              <View style={styles.actionRow}>
                {complaint.status === 1 && (
                  <TouchableOpacity 
                    style={styles.assignButtonPrimary} 
                    onPress={() => {
                      setIsReassignment(false);
                      handleOpenAssign();
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.assignButtonText}>Assign to Dept Head →</Text>
                  </TouchableOpacity>
                )}
                {complaint.status === 5 && (
                  <>
                    <TouchableOpacity 
                      style={[styles.assignButtonPrimary, { backgroundColor: '#f59e0b' }]} 
                      onPress={handleOpenReassign}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.assignButtonText}>Reassign to Dept Head ↺</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.assignButtonPrimary, { backgroundColor: '#10b981', marginTop: 12 }]} 
                      onPress={() => {
                        setReviewRemarks('');
                        setActiveReviewTab('approve');
                        setShowReviewModal(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.assignButtonText}>Review & Resolve ✓</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

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

        {/* Tab Content - Placeholder for others */}
        {activeTab !== 'overview' && activeTab !== 'timeline' && activeTab !== 'comments' && activeTab !== 'contactReporter' && (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyText}>This section is under development.</Text>
          </View>
        )}

        {/* Tab Content - Contact Reporter */}
        {activeTab === 'contactReporter' && (
          <View style={styles.tabContent}>
            {/* Contact Input Area */}
            <View style={[styles.commentInputContainer, { marginBottom: 16, borderTopWidth: 0, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 }]}>
              {newContactAttachment && (
                <View style={styles.commentAttachmentPreview}>
                  <Text style={styles.commentAttachmentPreviewText} numberOfLines={1}>{newContactAttachment.name}</Text>
                  <TouchableOpacity onPress={() => setNewContactAttachment(null)}>
                    <Text style={styles.commentAttachmentRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.commentInputRow}>
                <TouchableOpacity style={styles.attachBtn} onPress={handlePickContactDocument}>
                  <Text style={styles.attachBtnText}>📎</Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.commentInputField, { marginLeft: 0 }]}
                  placeholder="Type a message to the reporter..."
                  value={newContactMessage}
                  onChangeText={setNewContactMessage}
                  multiline
                  maxLength={500}
                />
              </View>
              <View style={{ flexDirection: 'column', marginTop: 12, gap: 12 }}>
                <View style={{ flexDirection: 'column', gap: 8 }}>
                  <TouchableOpacity 
                    onPress={() => complaint.reporterEmail && setNotifyByEmail(!notifyByEmail)} 
                    style={{ flexDirection: 'row', alignItems: 'center', opacity: complaint.reporterEmail ? 1 : 0.5 }}
                    disabled={!complaint.reporterEmail}
                  >
                    <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#0B2046', alignItems: 'center', justifyContent: 'center', marginRight: 6, backgroundColor: notifyByEmail ? '#0B2046' : 'transparent' }}>
                      {notifyByEmail && <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✓</Text>}
                    </View>
                    <Text style={{ fontSize: 13, color: '#374151', fontWeight: '500' }}>Email</Text>
                    <Text style={{ fontSize: 13, color: '#6b7280', marginLeft: 6 }}>{complaint.reporterEmail ? `(${complaint.reporterEmail})` : '(Not available)'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => complaint.reporterMobile && setNotifyBySms(!notifyBySms)} 
                    style={{ flexDirection: 'row', alignItems: 'center', opacity: complaint.reporterMobile ? 1 : 0.5 }}
                    disabled={!complaint.reporterMobile}
                  >
                    <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#0B2046', alignItems: 'center', justifyContent: 'center', marginRight: 6, backgroundColor: notifyBySms ? '#0B2046' : 'transparent' }}>
                      {notifyBySms && <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✓</Text>}
                    </View>
                    <Text style={{ fontSize: 13, color: '#374151', fontWeight: '500' }}>SMS</Text>
                    <Text style={{ fontSize: 13, color: '#6b7280', marginLeft: 6 }}>{complaint.reporterMobile ? `(${complaint.reporterMobile})` : '(Not available)'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                  <TouchableOpacity 
                    style={[styles.commentSendBtn, (!newContactMessage.trim() && !newContactAttachment) && { opacity: 0.5 }]} 
                    onPress={handleAddContactMessage}
                    disabled={isSubmittingContact || (!newContactMessage.trim() && !newContactAttachment)}
                  >
                    {isSubmittingContact ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.commentSendBtnText}>Send Request</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {complaint.contactReporterMessages && complaint.contactReporterMessages.length > 0 ? (
              complaint.contactReporterMessages.map((msg: any, idx: number) => (
                <View key={idx} style={styles.commentCard}>
                  <View style={styles.commentHeader}>
                    <View style={styles.commentAvatar}>
                      <Text style={styles.commentAvatarText}>{msg.senderName ? msg.senderName.charAt(0).toUpperCase() : 'U'}</Text>
                    </View>
                    <View style={styles.commentAuthorInfo}>
                      <Text style={styles.commentAuthor}>{msg.senderName || 'Unknown Sender'}</Text>
                      <Text style={styles.commentDate}>{formatDate(msg.messageAt)}</Text>
                    </View>
                  </View>
                  {!!msg.messageText && <Text style={styles.commentText}>{msg.messageText}</Text>}
                  
                  {/* Render Message Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <View style={styles.commentAttachmentsContainer}>
                      {msg.attachments.map((att: any, attIdx: number) => {
                        const url = att.storagePath || att.url || att.storedFileName;
                        const isImg = url && /\.(jpeg|jpg|gif|png|webp|bmp)$/i.test(url);
                        return (
                          <TouchableOpacity 
                            key={attIdx} 
                            style={styles.commentAttachmentItem}
                            activeOpacity={0.7}
                            onPress={() => {
                              if (url) {
                                if (isImg) setSelectedImage(url);
                                else Linking.openURL(url);
                              }
                            }}
                          >
                            <Text style={styles.commentAttachmentIcon}>📎</Text>
                            <Text style={styles.commentAttachmentName} numberOfLines={1}>
                              {att.fileName || `Attachment ${attIdx + 1}`}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', marginTop: 8, gap: 12 }}>
                    {msg.notifyByEmail && <Text style={{ fontSize: 11, color: '#0ea5e9' }}>📧 Notified via Email</Text>}
                    {msg.notifyBySms && <Text style={{ fontSize: 11, color: '#10b981' }}>📱 Notified via SMS</Text>}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyText}>No contact messages available.</Text>
              </View>
            )}
          </View>
        )}

        {/* Tab Content - Comments */}
        {activeTab === 'comments' && (
          <View style={styles.tabContent}>
            {/* Comment Input Area */}
            <View style={[styles.commentInputContainer, { marginBottom: 16, borderTopWidth: 0, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 }]}>
              {newCommentAttachments.map((att, idx) => (
                <View key={idx} style={[styles.commentAttachmentPreview, { flexDirection: 'column', alignItems: 'stretch' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={styles.commentAttachmentPreviewText} numberOfLines={1}>{att.file.name}</Text>
                    <TouchableOpacity onPress={() => setNewCommentAttachments(prev => prev.filter((_, i) => i !== idx))}>
                      <Text style={styles.commentAttachmentRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.commentInputField, { paddingVertical: 6, fontSize: 13, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb' }]}
                    placeholder="Enter description (max 20 chars)..."
                    value={att.description}
                    maxLength={20}
                    onChangeText={(text) => {
                      setNewCommentAttachments(prev => prev.map((p, i) => i === idx ? { ...p, description: text } : p));
                    }}
                  />
                </View>
              ))}
              <View style={styles.commentInputRow}>
                <TouchableOpacity style={styles.attachBtn} onPress={handlePickDocument}>
                  <Text style={styles.attachBtnText}>📎</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.commentInputField}
                  placeholder="Type a comment..."
                  value={newCommentText}
                  onChangeText={setNewCommentText}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity 
                  style={[styles.commentSendBtn, (!newCommentText.trim() && newCommentAttachments.length === 0) && { opacity: 0.5 }]} 
                  onPress={handleAddComment}
                  disabled={isSubmittingComment || (!newCommentText.trim() && newCommentAttachments.length === 0)}
                >
                  {isSubmittingComment ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.commentSendBtnText}>Send</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

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
                    {(isAdmin || comment.authorId === currentUserId) && editingCommentId !== comment.id && (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity style={styles.editCommentBtn} onPress={() => handleEditComment(comment)}>
                          <Text style={styles.editCommentText}>Edit</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {editingCommentId === comment.id ? (
                    <View style={{ marginTop: 8 }}>
                      <TextInput
                        style={[styles.commentInputField, { borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 }]}
                        value={editingCommentText}
                        onChangeText={setEditingCommentText}
                        multiline
                        autoFocus
                      />
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                        <TouchableOpacity style={[styles.commentSendBtn, { backgroundColor: '#f3f4f6' }]} onPress={handleCancelEditComment} disabled={isUpdatingComment}>
                          <Text style={[styles.commentSendBtnText, { color: '#4b5563' }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.commentSendBtn} onPress={() => handleUpdateComment(comment.id)} disabled={isUpdatingComment || !editingCommentText.trim()}>
                          {isUpdatingComment ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <Text style={styles.commentSendBtnText}>Save</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.commentText}>{comment.text}</Text>
                  )}
                  
                  {/* Render Comment Attachments */}
                  {comment.attachments && comment.attachments.length > 0 && (
                    <View style={styles.commentAttachmentsContainer}>
                      {comment.attachments.map((att: any, attIdx: number) => {
                        const url = att.storagePath || att.url || att.storedFileName;
                        const isImg = url && /\.(jpeg|jpg|gif|png|webp|bmp)$/i.test(url);
                        return (
                          <View key={attIdx} style={[styles.commentAttachmentItem, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 10 }]}>
                            <TouchableOpacity 
                              style={{ flexDirection: 'column', flex: 1, paddingVertical: 4 }}
                              activeOpacity={0.7}
                              onPress={() => {
                                if (url) {
                                  if (isImg) setSelectedImage(url);
                                  else Linking.openURL(url);
                                }
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.commentAttachmentIcon}>📎</Text>
                                <Text style={styles.commentAttachmentName} numberOfLines={1}>
                                  {att.fileName || `Attachment ${attIdx + 1}`}
                                </Text>
                              </View>
                              {!!att.description && (
                                <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2, paddingLeft: 22 }} numberOfLines={2}>
                                  {att.description}
                                </Text>
                              )}
                            </TouchableOpacity>
                            {(isAdmin || comment.authorId === currentUserId) && (
                              <TouchableOpacity 
                                style={styles.deleteAttachmentBtn} 
                                onPress={() => handleDeleteCommentAttachment(comment.id, att.id, att.fileName || `Attachment ${attIdx + 1}`)}
                              >
                                <Text style={styles.deleteAttachmentIcon}>🗑️</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              ))
            ) : (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyText}>No comments available.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      </View>

      {/* Image Preview Modal */}
      <Modal visible={!!selectedImage} transparent={true} animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity style={styles.imageModalCloseBtn} onPress={() => setSelectedImage(null)}>
            <Text style={styles.imageModalCloseText}>✕</Text>
          </TouchableOpacity>
          <Image source={{ uri: selectedImage || undefined }} style={styles.imageModalImage} resizeMode="contain" />
        </View>
      </Modal>

      {/* Assign Modal */}
      <Modal visible={showAssignModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.assignModalContainer}>
            <View style={styles.assignModalHeader}>
              <Text style={styles.assignModalTitle}>{isReassignment ? 'Reassign' : 'Assign'} to Department Head</Text>
              <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.assignModalBody} showsVerticalScrollIndicator={false}>
              
              {/* Department Selection */}
              <Text style={styles.inputLabel}>Select Department <Text style={{color: '#ef4444'}}>*</Text></Text>
              <View style={styles.headListContainer}>
                {departments.length === 0 ? (
                  <ActivityIndicator size="small" color="#0B2046" style={{ padding: 10 }} />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexDirection: 'row', paddingBottom: 10}}>
                    {departments.map(dept => (
                      <TouchableOpacity 
                        key={dept.id} 
                        style={[
                          styles.headItemButton,
                          { marginRight: 8, marginBottom: 0, alignSelf: 'flex-start' },
                          selectedDeptId === dept.id && styles.headItemButtonActive
                        ]}
                        onPress={() => {
                          setSelectedDeptId(dept.id);
                          setSelectedDeptHead(null); // Reset head selection
                        }}
                      >
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                          <Image source={{ uri: 'https://img.icons8.com/ios-filled/50/0B2046/building.png' }} style={{ width: 16, height: 16, marginRight: 6 }} />
                          <Text style={[
                            styles.headItemText,
                            selectedDeptId === dept.id && styles.headItemTextActive
                          ]}>
                            {dept.department}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>

              {/* Department Head Selection */}
              {selectedDeptId && (
                <>
                  <Text style={styles.inputLabel}>Select Department Head <Text style={{color: '#ef4444'}}>*</Text></Text>
                  <View style={styles.headListContainer}>
                    {allDepartmentHeads.filter(h => h.departmentId === selectedDeptId).length === 0 ? (
                      <Text style={styles.emptyText}>No department heads found for this department.</Text>
                    ) : (
                      allDepartmentHeads
                        .filter(h => h.departmentId === selectedDeptId)
                        .map(head => (
                        <TouchableOpacity 
                          key={head.id} 
                          style={[
                            styles.headItemButton,
                            selectedDeptHead?.id === head.id && styles.headItemButtonActive
                          ]}
                          onPress={() => setSelectedDeptHead(head)}
                        >
                          <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <Image source={{ uri: 'https://img.icons8.com/ios-filled/50/0B2046/user.png' }} style={{ width: 16, height: 16, marginRight: 6 }} />
                            <Text style={[
                              styles.headItemText,
                              selectedDeptHead?.id === head.id && styles.headItemTextActive
                            ]}>
                              {head.nameWithInitials} ({head.username})
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                </>
              )}

              {/* Resolution Date */}
              <Text style={styles.inputLabel}>Completion Due Date <Text style={{color: '#ef4444'}}>*</Text></Text>
              <TouchableOpacity 
                style={[styles.textInput, { justifyContent: 'center' }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={{color: resolutionDate ? '#111827' : '#9ca3af', fontSize: 15}}>
                  {resolutionDate || 'YYYY-MM-DD'}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={resolutionDate ? new Date(resolutionDate) : new Date(new Date().setDate(new Date().getDate() + 1))}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (event.type === 'set' && selectedDate) {
                      setResolutionDate(selectedDate.toISOString().slice(0, 10));
                    }
                  }}
                />
              )}

              {/* Minute (Remarks) */}
              <Text style={styles.inputLabel}>Minute <Text style={{color: '#ef4444'}}>*</Text></Text>
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsLabel}>Quick fill:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {minuteSuggestions.map((suggestion, idx) => (
                    <TouchableOpacity 
                      key={idx} 
                      style={styles.suggestionChip}
                      onPress={() => setAssignRemarks(suggestion)}
                    >
                      <Text style={styles.suggestionChipText}>{suggestion}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Enter minute details or choose a suggestion above..."
                placeholderTextColor="#9ca3af"
                value={assignRemarks}
                onChangeText={setAssignRemarks}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <Text style={styles.charCountText}>
                {assignRemarks.length}/500 {assignRemarks.length < 10 ? '(min 10 chars)' : ''}
              </Text>

              <TouchableOpacity 
                style={[styles.submitAssignBtn, isAssigning && styles.submitAssignBtnDisabled]} 
                onPress={handleAssignSubmit}
                disabled={isAssigning}
              >
                {isAssigning ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitAssignBtnText}>Confirm Assignment</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Review & Resolve Modal */}
      <Modal visible={showReviewModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.assignModalContainer}>
            <View style={styles.assignModalHeader}>
              <Text style={styles.assignModalTitle}>Review & Resolve</Text>
              <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {/* Review Tabs */}
            <View style={[styles.tabsContainer, { marginHorizontal: 20, marginTop: 10 }]}>
              <TouchableOpacity
                style={[styles.tabButton, activeReviewTab === 'approve' && styles.tabButtonActive]}
                onPress={() => setActiveReviewTab('approve')}
              >
                <Text style={[styles.tabText, activeReviewTab === 'approve' && styles.tabTextActive]}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, activeReviewTab === 'disapprove' && styles.tabButtonActive]}
                onPress={() => setActiveReviewTab('disapprove')}
              >
                <Text style={[styles.tabText, activeReviewTab === 'disapprove' && styles.tabTextActive]}>Disapprove</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.assignModalBody} showsVerticalScrollIndicator={false}>
              
              {/* Remarks/Minute */}
              <View style={{ marginBottom: 20 }}>
                <Text style={styles.inputLabel}>{activeReviewTab === 'approve' ? 'Resolution Remarks' : 'Disapproval Reason'} <Text style={{color:'#ef4444'}}>*</Text></Text>
                
                {activeReviewTab === 'approve' && (
                  <View style={styles.suggestionsContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      {['Complaint resolved.', 'Issue fixed.', 'Action taken.'].map((suggestion, idx) => (
                        <TouchableOpacity 
                          key={idx} 
                          style={styles.suggestionChip}
                          onPress={() => setReviewRemarks(suggestion)}
                        >
                          <Text style={styles.suggestionChipText}>{suggestion}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  multiline
                  placeholder={`Type your ${activeReviewTab === 'approve' ? 'resolution remarks' : 'disapproval reason'}...`}
                  placeholderTextColor="#9ca3af"
                  value={reviewRemarks}
                  onChangeText={setReviewRemarks}
                  maxLength={500}
                />
                <Text style={styles.charCountText}>
                  {reviewRemarks.length}/500 {reviewRemarks.length < 5 ? '(min 5 chars)' : ''}
                </Text>
              </View>

              <TouchableOpacity 
                style={[styles.submitAssignBtn, {backgroundColor: activeReviewTab === 'approve' ? '#10b981' : '#ef4444'}, isReviewing && styles.submitAssignBtnDisabled]} 
                onPress={handleReviewSubmit}
                disabled={isReviewing}
                activeOpacity={0.8}
              >
                {isReviewing ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitAssignBtnText}>{activeReviewTab === 'approve' ? 'Resolve Complaint' : 'Disapprove & Return'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B2046',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
    color: '#0B2046',
    fontWeight: '600',
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#0B2046',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  backIcon: {
    fontSize: 20,
    color: '#ffffff',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
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
    color: '#0B2046',
    fontSize: 12,
    fontWeight: '700',
  },
  updatedText: {
    fontSize: 13,
    color: '#6b7280',
  },
  statsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  statsRow: {
    flexDirection: 'row',
    padding: 20,
  },
  statsDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
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
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tabButton: {
    flex: 1,
    paddingHorizontal: 2,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#0B2046',
  },
  tabContent: {
    gap: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  cardBody: {
    padding: 20,
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
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
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
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    color: '#94a3b8',
  },
  editCommentBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  editCommentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
    textTransform: 'uppercase',
  },
  deleteAttachmentBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#fef2f2',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteAttachmentIcon: {
    fontSize: 16,
    color: '#ef4444',
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  actionRow: {
    marginTop: 20,
    alignItems: 'center',
  },
  assignButtonPrimary: {
    backgroundColor: '#0B2046',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0B2046',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  assignButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  assignModalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  assignModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  assignModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  closeIcon: {
    fontSize: 20,
    color: '#6b7280',
    padding: 4,
  },
  assignModalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  headListContainer: {
    maxHeight: 180,
  },
  headItemButton: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
    backgroundColor: '#ffffff',
  },
  headItemButtonActive: {
    borderColor: '#0B2046',
    backgroundColor: '#eff6ff',
  },
  headItemText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  headItemTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  textArea: {
    height: 100,
  },
  submitAssignBtn: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 50,
  },
  submitAssignBtnDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitAssignBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  suggestionsContainer: {
    marginBottom: 4,
  },
  suggestionsLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  suggestionChip: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  suggestionChipText: {
    fontSize: 12,
    color: '#374151',
  },
  charCountText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 4,
  },
  commentInputContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 'auto',
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentInputField: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: '#1f2937',
  },
  attachBtn: {
    padding: 10,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachBtnText: {
    fontSize: 18,
  },
  commentSendBtn: {
    marginLeft: 12,
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentSendBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  commentAttachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    justifyContent: 'space-between',
  },
  commentAttachmentPreviewText: {
    color: '#1d4ed8',
    flex: 1,
    fontSize: 13,
  },
  commentAttachmentRemoveText: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
    paddingHorizontal: 4,
  },
  commentAttachmentsContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 8,
  },
  commentAttachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  commentAttachmentIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  commentAttachmentName: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
  }
});
