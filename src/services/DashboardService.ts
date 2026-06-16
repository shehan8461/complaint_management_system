// DashboardService.ts — Handles fetching data for the CMS Dashboard
import { ApiService } from './ApiService';
import { DashboardEndpoints } from '../constants/AppConstants';

// Simplified interfaces for mobile based on web CMSComplaintViewModel
export interface CMSComplaintListItem {
  id: number;
  complaintNumber: string;
  category: string;
  title: string;
  status: number;
  priority: number;
  createdAt: string;
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
};
