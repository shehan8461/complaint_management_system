import { ApiService } from './ApiService';

export interface UserUpdatePayload {
  ID: number;
  NameInFull?: string;
  NameWithInitials?: string;
  Username: string;
  Password?: string;
  NIC?: string;
  ContactNo?: string;
  Birthday?: string | null;
  SabhaID?: number | null;
  OfficeID?: number | null;
  ActiveStatus?: number | null;
  GenderID?: number | null;
  ProfilePicPath?: string | null;
  IsAdmin?: number;
  IsRI?: number;
  OrganizationTypeId?: number | null;
  NonLA_OfficeId?: number | null;
  ProvinceID?: number | null;
  RoleId?: number | null;
  DepartmentId?: number | null;
}

export const UserService = {
  /**
   * Update User (used for password change, profile updates, etc.)
   * POST /Users/updateUser
   */
  async updateUser(payload: UserUpdatePayload): Promise<any> {
    const response = await ApiService.post<any>('/Users/updateUser', payload);
    return response.data;
  },

  /**
   * Get Full User Profile by ID
   * GET /Users/getUserById/{id}
   */
  async getUserById(id: number): Promise<any> {
    const response = await ApiService.get<any>(`/Users/getUserById/${id}`);
    return response.data;
  },

  /**
   * Upload User Image
   * POST /Users/uploadUserImage
   */
  async uploadUserImage(id: number, fileUri: string, fileName: string, fileType: string): Promise<any> {
    const formData = new FormData();
    formData.append('id', String(id));
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: fileType,
    } as any);

    const response = await ApiService.post<any>('/Users/uploadUserImage', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};
