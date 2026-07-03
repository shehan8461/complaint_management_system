// DashboardService.ts — Handles fetching data for the CMS Dashboard
import { ApiService } from './ApiService';
import { DashboardEndpoints, API_BASE_URL } from '../constants/AppConstants';

const getAttachmentUrl = (filePath: string): string => {
  if (!filePath) return '';
  if (/^https?:\/\//i.test(filePath)) return filePath;
  const baseUrl = API_BASE_URL.replace(/\/api\/?$/, '');
  if (filePath.startsWith('/api/')) {
    return `${baseUrl}${filePath}`;
  }
  const apiBase = API_BASE_URL.replace(/\/$/, '');
  return `${apiBase}/Files/complaint_attachment/${encodeURIComponent(filePath)}`;
};

// Simplified interfaces for mobile based on web CMSComplaintViewModel
export interface CMSComplaintListItem {
  id: number;
  complaintNumber: string;
  category: string;
  serviceName?: string;
  title: string;
  status: number;
  priority: number;
  createdAt: string;
}

export interface CMSComplaintDetail extends CMSComplaintListItem {
  description: string;
  reporterNic?: string;
  reporterMobile?: string;
  reporterEmail?: string;
  reporterAddress?: string;
  reporterName?: string;
  attachments?: any[];
  comments?: any[];
  statusHistory?: any[];
  assignments?: any[];
  contactReporterMessages?: any[];
  assignedTo?: string;
  resolutionDueAt?: string;
}

export interface CMSPagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

export interface CMSDashboardSummary {
  totalComplaints: number;
  pendingComplaints: number;
  resolvedComplaints: number;
  closedComplaints: number;
  overdueComplaints: number;
  inProgressComplaints?: number;
  criticalComplaints?: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byService: Record<string, number>;
}

export interface CMSApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface CMSUser {
  id: number;
  nameWithInitials: string;
  username: string;
  roleId?: number;
  roleName?: string;
  departmentId?: number | null;
}

export interface CMSDepartment {
  id: number;
  department: string;
}

export interface CMSAssignComplaintPayload {
  toUserId: number;
  toUserName?: string | null;
  toRole: number;
  toOrgUnitId?: number | null;
  remarks?: string | null;
  isReassignment?: boolean;
  resolutionDueAt?: string | null;
}

export const DashboardService = {
  /**
   * Get dashboard summary stats
   */
  async getSummary(): Promise<CMSDashboardSummary> {
    const response = await ApiService.get<CMSApiResponse<CMSDashboardSummary>>(DashboardEndpoints.SUMMARY);
    return response.data.data;
  },

  /**
   * Get all complaints (For CMS Admins)
   */
  async getAllComplaints(pageNumber = 1, pageSize = 10): Promise<CMSPagedResult<CMSComplaintListItem>> {
    const response = await ApiService.get<CMSApiResponse<CMSPagedResult<CMSComplaintListItem>>>(
      DashboardEndpoints.ALL_COMPLAINTS,
      { pageNumber, pageSize }
    );
    return response.data.data;
  },

  /**
   * Get assigned complaints (For Department Head / Subject)
   */
  async getAssignedComplaints(pageNumber = 1, pageSize = 10): Promise<CMSPagedResult<CMSComplaintListItem>> {
    const response = await ApiService.get<CMSApiResponse<CMSPagedResult<CMSComplaintListItem>>>(
      DashboardEndpoints.ASSIGNED_COMPLAINTS,
      { pageNumber, pageSize }
    );
    return response.data.data;
  },

  /**
   * Get single complaint by ticket number
   */
  async getComplaintByNumber(ticketNo: string): Promise<CMSComplaintDetail> {
    const response = await ApiService.get<CMSApiResponse<any>>(
      `/cms/complaints/${ticketNo}`
    );
    const source = response.data.data;
    if (!source) return source;

    const reporter = source.reporter || source.Reporter || {};

    return {
      id: source.id || source.Id,
      complaintNumber: source.ticketNo || source.TicketNo || source.complaintNumber,
      category: source.categoryName || source.CategoryName || source.customCategory || source.CustomCategory || source.category || '',
      serviceName: source.serviceName || source.ServiceName || source.customService || source.CustomService || '',
      title: source.title || source.Title || '',
      description: source.description || source.Description || source.complaintDescription || source.ComplaintDescription || source.details || source.Details || '',
      status: source.status || source.Status || 1,
      priority: source.priority || source.Priority || 2,
      createdAt: source.createdAt || source.CreatedAt || new Date().toISOString(),
      reporterNic: source.reporterNic || source.ReporterNic || source.reporterNicMasked || source.ReporterNicMasked || reporter.nic || reporter.Nic || '',
      reporterMobile: source.reporterMobile || source.ReporterMobile || source.reporterMobileMasked || source.ReporterMobileMasked || reporter.mobile || reporter.Mobile || '',
      reporterEmail: source.reporterEmail || source.ReporterEmail || reporter.email || reporter.Email || '',
      reporterAddress: source.reporterAddress || source.ReporterAddress || reporter.address || reporter.Address || '',
      reporterName: source.reporterName || source.ReporterName || reporter.name || reporter.Name || '',
      assignedTo: source.currentAssigneeName || source.CurrentAssigneeName || source.assignedTo || source.AssignedTo || 'Unassigned',
      resolutionDueAt: source.resolutionDueAt || source.ResolutionDueAt || null,
      attachments: (source.attachments || source.Attachments || []).map((a: any) => ({
        id: a.id || a.Id,
        fileName: a.fileName || a.FileName || 'Attachment',
        description: a.description || a.Description || null,
        url: getAttachmentUrl(a.url || a.Url || a.filePath || a.FilePath || a.storagePath || a.StoragePath || a.storedFileName || a.StoredFileName || ''),
      })),
      comments: (source.comments || source.Comments || []).map((c: any) => ({
        id: c.id || c.Id,
        text: c.commentText || c.CommentText || '',
        author: c.commentedByUserName || c.CommentedByUserName || 'Unknown User',
        authorId: c.commentedByUserId || c.CommentedByUserId,
        date: c.commentedAt || c.CommentedAt || source.createdAt || source.CreatedAt,
        attachments: (c.attachments || c.Attachments || []).map((a: any) => ({
          id: a.id || a.Id,
          fileName: a.fileName || a.FileName || 'Attachment',
          description: a.description || a.Description || null,
          url: getAttachmentUrl(a.url || a.Url || a.filePath || a.FilePath || a.storagePath || a.StoragePath || a.storedFileName || a.StoredFileName || ''),
        })),
      })),
      statusHistory: (source.statusHistory || source.StatusHistory || []).map((h: any) => ({
        id: h.id || h.Id,
        fromStatus: h.fromStatus || h.FromStatus,
        toStatus: h.toStatus || h.ToStatus,
        remarks: h.remarks || h.Remarks,
        changedBy: h.changedByDisplayName || h.ChangedByDisplayName || h.changedByUserName || h.ChangedByUserName || 'System',
        changedAt: h.changedAt || h.ChangedAt,
        attachments: (h.attachments || h.Attachments || []).map((a: any) => ({
          id: a.id || a.Id,
          fileName: a.fileName || a.FileName || 'Attachment',
          url: getAttachmentUrl(a.url || a.Url || a.filePath || a.FilePath || a.storagePath || a.StoragePath || a.storedFileName || a.StoredFileName || ''),
        })),
      })),
      assignments: source.assignments || source.Assignments || [],
      contactReporterMessages: (source.contactReporterMessages || source.ContactReporterMessages || []).map((m: any) => ({
        id: m.id || m.Id,
        sender: m.sender || m.Sender || 0,
        senderUserId: m.senderUserId || m.SenderUserId || null,
        senderName: m.senderName || m.SenderName || null,
        messageText: m.messageText || m.MessageText || '',
        notifyByEmail: m.notifyByEmail || m.NotifyByEmail || false,
        notifyBySms: m.notifyBySms || m.NotifyBySms || false,
        emailRecipient: m.emailRecipient || m.EmailRecipient || null,
        mobileRecipient: m.mobileRecipient || m.MobileRecipient || null,
        messageAt: m.messageAt || m.MessageAt || new Date().toISOString(),
        attachments: (m.attachments || m.Attachments || []).map((a: any) => ({
          id: a.id || a.Id,
          fileName: a.fileName || a.FileName || a.description || a.Description || 'Attachment',
          url: getAttachmentUrl(a.url || a.Url || a.filePath || a.FilePath || a.storagePath || a.StoragePath || a.storedFileName || a.StoredFileName || ''),
        })),
      })),
    } as CMSComplaintDetail;
  },

  /**
   * Fetch all CMS users
   */
  async getCmsUsers(): Promise<CMSUser[]> {
    const response = await ApiService.get<any>('/users/cms-users');
    const users = Array.isArray(response.data) ? response.data : (response.data?.data || []);
    
    return users.map((u: any) => ({
      id: u.id || u.ID,
      nameWithInitials: u.nameWithInitials || u.NameWithInitials || u.username || u.Username,
      username: u.username || u.Username,
      roleId: u.roleId || u.RoleId,
      roleName: u.roleName || u.RoleName || 'Unknown',
      departmentId: u.departmentId || u.DepartmentId || null
    }));
  },

  /**
   * Fetch all CMS Departments
   */
  async getDepartments(): Promise<CMSDepartment[]> {
    const response = await ApiService.get<any>('/control/officeDepartement/GetAllForContext');
    const depts = Array.isArray(response.data) ? response.data : (response.data?.data || []);
    return depts.map((d: any) => ({
      id: d.id || d.Id,
      department: d.department || d.Department || 'Unknown'
    }));
  },

  /**
   * Assign a complaint
   */
  async assignComplaint(id: number, payload: CMSAssignComplaintPayload): Promise<CMSComplaintDetail> {
    const requestPayload = {
      ToUserId: payload.toUserId,
      ToUserName: payload.toUserName || null,
      ToRole: payload.toRole,
      ToOrgUnitId: payload.toOrgUnitId || null,
      Remarks: payload.remarks || null,
      IsReassignment: payload.isReassignment || false,
      ResolutionDueAt: payload.resolutionDueAt || null
    };

    const response = await ApiService.post<CMSApiResponse<any>>(`/cms/complaints/${id}/assign`, requestPayload);
    return response.data as unknown as CMSComplaintDetail;
  },

  /**
   * Update complaint status (e.g. resolve)
   */
  async updateComplaintStatus(id: number, payload: { status: number; remarks?: string; resolutionSummary?: string; feedbackRating?: number | null; feedbackComment?: string | null }): Promise<void> {
    await ApiService.post<any>(`/cms/complaints/${id}/status`, payload);
  },

  /**
   * Upload an attachment for a complaint comment
   */
  async uploadComplaintAttachment(file: any, complaintId: number): Promise<any> {
    const formData = new FormData();
    formData.append('file', file as any);
    formData.append('complaintId', complaintId.toString());

    const response = await ApiService.post<any>('/files/upload/complaint', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      transformRequest: (data, headers: any) => {
        // Unset the explicit Content-Type so Axios/React Native can auto-set the boundary
        delete headers['Content-Type'];
        return data;
      }
    });
    return response.data;
  },

  /**
   * Add a comment to a complaint
   */
  async addComment(id: number, payload: { commentText: string; visibility: number; attachments?: any[] }): Promise<any> {
    const requestPayload = {
      commentText: payload.commentText,
      visibility: payload.visibility,
      attachments: (payload.attachments || []).map((attachment: any) => {
        const fileName = attachment.fileName || attachment.FileName || '';
        const rawDescription = attachment.description || attachment.Description || fileName || '';
        return {
          fileName,
          storedFileName: attachment.storedFileName || attachment.StoredFileName || attachment.storagePath || attachment.StoragePath || '',
          contentType: attachment.contentType || attachment.ContentType || 'application/octet-stream',
          fileSizeInBytes: attachment.fileSizeInBytes || attachment.FileSizeInBytes || 0,
          storagePath: attachment.storagePath || attachment.StoragePath || attachment.storedFileName || attachment.StoredFileName || null,
          description: rawDescription ? rawDescription.substring(0, 20) : null
        };
      })
    };

    const response = await ApiService.post<any>(`/cms/complaints/${id}/comments`, requestPayload);
    return response.data?.data || response.data;
  },

  /**
   * Update a comment on a complaint
   */
  async updateComment(complaintId: number, commentId: number, payload: { commentText: string }): Promise<any> {
    const response = await ApiService.put<any>(`/cms/complaints/${complaintId}/comments/${commentId}`, {
      commentText: payload.commentText
    });
    return response.data?.data || response.data;
  },

  /**
   * Delete a complaint attachment
   */
  async deleteComplaintAttachment(complaintId: number, attachmentId: number): Promise<void> {
    await ApiService.delete(`/cms/complaints/${complaintId}/attachments/${attachmentId}`);
  },

  /**
   * Delete a comment attachment
   */
  async deleteCommentAttachment(complaintId: number, commentId: number, attachmentId: number): Promise<void> {
    await ApiService.delete(`/cms/complaints/${complaintId}/comments/${commentId}/attachments/${attachmentId}`);
  },

  /**
   * Add a new Contact Reporter Message
   */
  async addContactReporterMessage(id: number, payload: { messageText: string; notifyByEmail: boolean; notifyBySms: boolean; attachments?: any[] }): Promise<any> {
    const requestPayload = {
      messageText: payload.messageText,
      notifyByEmail: payload.notifyByEmail,
      notifyBySms: payload.notifyBySms,
      attachments: payload.attachments || []
    };

    const response = await ApiService.post<any>(`/cms/complaints/${id}/contact-reporter`, requestPayload);
    return response.data;
  }
};
