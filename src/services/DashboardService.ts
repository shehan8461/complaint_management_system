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
        url: getAttachmentUrl(a.url || a.Url || a.filePath || a.FilePath || ''),
      })),
      comments: (source.comments || source.Comments || []).map((c: any) => ({
        id: c.id || c.Id,
        text: c.commentText || c.CommentText || '',
        author: c.commentedByUserName || c.CommentedByUserName || 'Unknown User',
        date: c.commentedAt || c.CommentedAt || source.createdAt || source.CreatedAt,
        attachments: (c.attachments || c.Attachments || []).map((a: any) => ({
          id: a.id || a.Id,
          fileName: a.fileName || a.FileName || 'Attachment',
          url: getAttachmentUrl(a.url || a.Url || a.filePath || a.FilePath || ''),
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
          url: getAttachmentUrl(a.url || a.Url || a.filePath || a.FilePath || ''),
        })),
      })),
    } as CMSComplaintDetail;
  },
};
