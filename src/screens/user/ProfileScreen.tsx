import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, StatusBar, Image, TextInput, Alert, DeviceEventEmitter } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import Toast from 'react-native-toast-message';
import { AuthService, UserModel } from '../../services/AuthService';
import { UserService } from '../../services/UserService';

export function ProfileScreen() {
  const navigation = useNavigation<any>();
  const [user, setUser] = useState<UserModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Form State
  const [nameInFull, setNameInFull] = useState('');
  const [nameWithInitials, setNameWithInitials] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [nic, setNic] = useState('');
  const [birthday, setBirthday] = useState('');
  const [genderId, setGenderId] = useState<number | null>(null);
  const [gender, setGender] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const authData = await AuthService.getMe();
      if (authData?.id) {
        // Fetch full profile to get NIC, Birthday, etc.
        const fullProfile = await UserService.getUserById(Number(authData.id));
        const mergedData = { ...authData, ...fullProfile };
        setUser(mergedData);
        initForm(mergedData);
      } else {
        setUser(authData);
        initForm(authData);
      }
    } catch (error) {
      console.error('Failed to load profile', error);
    } finally {
      setIsLoading(false);
    }
  };

  const initForm = (data: UserModel) => {
    setNameInFull(data.fullName || data.nameInFull || '');
    setNameWithInitials(data.nameWithInitials || '');
    setUsername(data.username || '');
    setPhone(data.phone || data.contactNo || '');
    
    const userNic = (data.nic || data.NIC || '').trim().toUpperCase();
    setNic(userNic);
    
    let bday = data.birthday || '';
    if (bday.includes('T')) {
      bday = bday.split('T')[0];
    }
    
    let genId = data.genderId || null;
    let gen = data.gender || getGenderDescription(data.genderId);
    
    if (userNic && isValidNic(userNic)) {
      const derived = calculateBirthdayAndGender(userNic);
      bday = bday || derived.birthday;
      genId = genId ?? derived.genderId;
      gen = gen || getGenderDescription(derived.genderId) || derived.gender;
    }
    
    setBirthday(bday);
    setGenderId(genId);
    setGender(gen);
  };

  const isValidNic = (val: string) => {
    const clean = (val || '').trim().toUpperCase();
    return /^\d{9}[VX]$/.test(clean) || /^\d{12}$/.test(clean);
  };

  const normalisePhone = (val: string, forceDigits: boolean) => {
    let digits = (val || '').replace(/\D/g, '');
    
    if (digits.startsWith('94') && digits.length >= 11) {
      digits = '0' + digits.slice(2);
    }
    
    if (forceDigits) {
      if (digits.length === 9) digits = '0' + digits;
      return digits;
    }
    return digits.slice(0, 10);
  };

  const calculateBirthdayAndGender = (val: string) => {
    let year = 0, days = 0, genId = 1;
    if (val.length === 10) {
      year = 1900 + Number(val.substring(0, 2));
      days = Number(val.substring(2, 5));
    } else {
      year = Number(val.substring(0, 4));
      days = Number(val.substring(4, 7));
    }
    if (days > 500) { days -= 500; genId = 2; }
    const monthDays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let month = 0, day = 0;
    for (let index = 0; index < monthDays.length; index++) {
      if (days <= monthDays[index]) { month = index + 1; day = days; break; }
      days -= monthDays[index];
    }
    return {
      birthday: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
      genderId: genId,
      gender: genId === 1 ? 'Male' : 'Female',
    };
  };

  const getGenderDescription = (id: number | null | undefined) => {
    if (!id) return '';
    return id === 1 ? 'Male' : id === 2 ? 'Female' : '';
  };

  const handleNicChange = (val: string) => {
    const clean = val.toUpperCase();
    setNic(clean);
    if (clean && isValidNic(clean)) {
      const derived = calculateBirthdayAndGender(clean);
      setBirthday(derived.birthday);
      setGenderId(derived.genderId);
      setGender(derived.gender);
    } else {
      setBirthday('');
      setGenderId(null);
      setGender('');
    }
  };

  const handlePickImage = async () => {
    try {
      const res = await pick({
        type: [types.images],
        allowMultiSelection: false,
      });
      
      if (res && res.length > 0 && user?.id) {
        const file = res[0];
        setIsUploadingImage(true);
        const prevImage = user.profilePicPath;
        
        // Optimistic UI update
        setUser(prev => prev ? { ...prev, profilePicPath: file.uri } : null);

        try {
          await UserService.uploadUserImage(Number(user.id), file.uri, file.name || 'profile.jpg', file.type || 'image/jpeg');
          Toast.show({
            type: 'success',
            text1: 'Success',
            text2: 'Profile picture updated successfully.'
          });
          await fetchProfile();
        } catch (err: any) {
          setUser(prev => prev ? { ...prev, profilePicPath: prevImage } : null);
          Alert.alert('Error', err.response?.data?.message || 'Failed to upload image.');
        }
      }
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        // User cancelled, do nothing
      } else {
        Alert.alert('Error', 'Failed to pick image.');
      }
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!nameInFull || !nameWithInitials || !username || !phone || !nic) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }
    if (!isValidNic(nic)) {
      Alert.alert('Error', 'Invalid NIC format.');
      return;
    }
    const cleanPhone = normalisePhone(phone, true);
    if (cleanPhone.length !== 10) {
      Alert.alert('Error', 'Invalid Phone Number format.');
      return;
    }

    if (!user) return;

    try {
      setIsSaving(true);
      const payload = {
        ID: Number(user.id),
        NameInFull: nameInFull.trim(),
        NameWithInitials: nameWithInitials.trim(),
        Username: username.trim().toLowerCase(),
        NIC: nic.trim().toUpperCase(),
        ContactNo: cleanPhone,
        Birthday: birthday || null,
        SabhaID: user.sabhaId || null,
        OfficeID: user.officeId || null,
        ActiveStatus: user.activeStatus ?? 1,
        GenderID: genderId || null,
        ProfilePicPath: user.profilePicPath || null,
        IsAdmin: user.isAdmin ? 1 : 0,
        IsRI: 0,
        OrganizationTypeId: user.organizationTypeId || null,
        NonLA_OfficeId: user.nonLaOfficeId || null,
        ProvinceID: user.provinceId || null,
        RoleId: user.roleId || null,
        DepartmentId: user.departmentId || null,
      };

      const updatedData = await UserService.updateUser(payload);
      // Wait for it and refresh data
      await fetchProfile();
      setIsEditMode(false);
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Profile updated successfully.'
      });
      DeviceEventEmitter.emit('PROFILE_UPDATED');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderEditableRow = (label: string, value: string, onChange: (t:string) => void, keyboardType: any = 'default', editable: boolean = true, icon: string) => (
    <View style={styles.editableRow}>
      <View style={styles.iconCircle}>
        <Text style={[styles.iconEmoji, icon === '✎' && { transform: [{ scaleX: -1 }] }]}>{icon}</Text>
      </View>
      <View style={styles.editableTextContainer}>
        <Text style={styles.editLabel}>{label}</Text>
        <View style={[styles.inputContainer, !editable && styles.inputContainerDisabled]}>
          <TextInput 
            style={[styles.inputField, !editable && styles.inputDisabled]}
            value={value}
            onChangeText={onChange}
            keyboardType={keyboardType}
            editable={editable}
          />
        </View>
      </View>
    </View>
  );

  const renderInfoRow = (label: string, value: string | undefined, icon: string) => (
    <View style={styles.infoRow}>
      <View style={styles.iconCircle}>
        <Text style={[styles.iconEmoji, icon === '✎' && { transform: [{ scaleX: -1 }] }]}>{icon}</Text>
      </View>
      <View style={styles.infoTextContainer}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '-'}</Text>
      </View>
    </View>
  );

  const getRoleName = (role: any) => {
    const roleId = Number(role);
    if (!isNaN(roleId)) {
      const roleNames: Record<number, string> = {
        9: 'CMS Admin',
        10: 'Department Head',
        11: 'Subject',
      };
      return roleNames[roleId] || String(role);
    }
    return String(role);
  };

  const rawRole = user?.rule?.name || user?.role || (user?.roles && user.roles.length > 0 ? user.roles[0] : null);
  const userRole = rawRole ? getRoleName(rawRole) : 'Not available';
  
  const userDepartment = user?.departmentName || user?.department?.name || 'Not available';
  
  const isCompanyUser = user?.organizationTypeId === 8;
  const organizationLabel = isCompanyUser ? 'Company' : 'Local Authority';
  const organizationName = isCompanyUser 
    ? (user?.orgNameEnglish || user?.companyName || 'Not available')
    : (user?.sabha?.nameEN || user?.sabha?.name || user?.sabhaNameEnglish || user?.orgNameEnglish || 'Not available');
    
  const officeName = isCompanyUser 
    ? null 
    : (user?.office?.nameEN || user?.office?.name || user?.officeName || 'Not available');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F4C81" />
      
      {/* Blue Background Cover */}
      <View style={styles.blueHeaderBg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => {
          if (isEditMode) setIsEditMode(false);
          else navigation.goBack();
        }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditMode ? 'EDIT PROFILE' : 'MY PROFILE'}</Text>
        {isEditMode ? (
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
            {isSaving ? <ActivityIndicator color="#0F4C81" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditMode(true)}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0F4C81" />
        </View>
      ) : user ? (
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatarCircle}>
                {user.profilePicPath ? (
                  <Image source={{ uri: user.profilePicPath }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitials}>
                    {(user.nameInFull || user.fullName || user.nameWithInitials || user.username).charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              {isUploadingImage ? (
                <View style={styles.avatarEditBtn}>
                  <ActivityIndicator color="#ffffff" size="small" />
                </View>
              ) : (
                <TouchableOpacity style={styles.avatarEditBtn} onPress={handlePickImage}>
                  <Text style={[styles.avatarEditIcon, { transform: [{ scaleX: -1 }] }]}>✎</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.userNameContainer}>
              <Text style={styles.userName}>{user.nameInFull || user.fullName || user.nameWithInitials || user.username}</Text>
              {((user.nameInFull || user.fullName || user.nameWithInitials) && (user.nameInFull || user.fullName || user.nameWithInitials) !== user.username) && (
                <View style={styles.emailContainer}>
                  <Text style={styles.emailIcon}>✉</Text>
                  <Text style={styles.userEmail}>{user.username}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Info Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Personal Information</Text>
            </View>
            <View style={styles.cardBody}>
              {isEditMode ? (
                <View>
                  {renderEditableRow('Name with Initials', nameWithInitials, setNameWithInitials, 'default', true, '⊚')}
                  {renderEditableRow('Full Name', nameInFull, setNameInFull, 'default', true, '✎')}
                  {renderEditableRow('Username / Email', username, () => {}, 'default', false, '✉')}
                  {renderEditableRow('Phone Number', phone, (v) => setPhone(normalisePhone(v, false)), 'phone-pad', true, '✆')}
                  {renderEditableRow('National ID', nic, handleNicChange, 'default', true, '⊟')}
                  {renderEditableRow('Date of Birth', birthday, () => {}, 'default', false, '◷')}
                  {renderEditableRow('Gender', gender, () => {}, 'default', false, '⚥')}
                </View>
              ) : (
                <View>
                  {renderInfoRow('Name with Initials', nameWithInitials, '⊚')}
                  <View style={styles.divider} />
                  {renderInfoRow('Full Name', nameInFull, '✎')}
                  <View style={styles.divider} />
                  {renderInfoRow('Username / Email', username, '✉')}
                  <View style={styles.divider} />
                  {renderInfoRow('Phone Number', phone, '✆')}
                  <View style={styles.divider} />
                  {renderInfoRow('National ID', nic, '⊟')}
                  <View style={styles.divider} />
                  {renderInfoRow('Date of Birth', birthday, '◷')}
                  <View style={styles.divider} />
                  {renderInfoRow('Gender', gender, '⚥')}
                </View>
              )}
            </View>
          </View>
          
          {!isEditMode && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>System Details</Text>
              </View>
              <View style={styles.cardBody}>
                {renderInfoRow('Role', userRole, '◈')}
                <View style={styles.divider} />
                {renderInfoRow('Department', userDepartment, '⌂')}
                {!isCompanyUser && (
                  <>
                    <View style={styles.divider} />
                    {renderInfoRow('Office', officeName as string, '⛫')}
                  </>
                )}
                <View style={styles.divider} />
                {renderInfoRow(organizationLabel, organizationName, '⚲')}
              </View>
            </View>
          )}
          
          {!isEditMode && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Account Actions</Text>
              </View>
              <View style={styles.cardBody}>
                <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('ChangePassword')}>
                  <View style={styles.actionRowLeft}>
                    <View style={styles.iconCircle}>
                      <Text style={styles.iconEmoji}>⚿</Text>
                    </View>
                    <Text style={styles.actionText}>Change Password</Text>
                  </View>
                  <Text style={styles.actionChevron}>›</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

        </ScrollView>
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Failed to load profile data.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  blueHeaderBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: '#0F4C81',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '300',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  saveBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#0F4C81',
    fontSize: 14,
    fontWeight: '700',
  },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  editBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '500',
  },
  scrollContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  avatarInitials: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#0F4C81',
  },
  avatarImage: {
    width: 102,
    height: 102,
    borderRadius: 51,
  },
  avatarEditBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0F4C81',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#F8FAFC',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  avatarEditIcon: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userNameContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
    textAlign: 'center',
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emailIcon: {
    fontSize: 14,
    color: '#64748b',
    marginRight: 6,
  },
  userEmail: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    textAlign: 'center',
  },
  userRole: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F4C81',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardBody: {
    padding: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  iconCircle: {
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconEmoji: {
    fontSize: 20,
    color: '#0F4C81',
    fontWeight: '300',
  },
  infoTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginLeft: 56,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  actionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 16,
    color: '#0F4C81',
    fontWeight: '600',
  },
  actionChevron: {
    fontSize: 24,
    color: '#94a3b8',
    fontWeight: '300',
  },
  editableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  editableTextContainer: {
    flex: 1,
  },
  editLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  inputContainerDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  inputField: {
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
  },
  inputDisabled: {
    color: '#94a3b8',
  }
});
