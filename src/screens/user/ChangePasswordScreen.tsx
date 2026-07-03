import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, TextInput, ScrollView, ActivityIndicator, StatusBar, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthService, UserModel } from '../../services/AuthService';
import { UserService } from '../../services/UserService';
import { DeviceEventEmitter } from 'react-native';

export function ChangePasswordScreen() {
  const navigation = useNavigation<any>();
  const [user, setUser] = useState<UserModel | null>(null);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    AuthService.getMe().then(setUser).catch(console.error);
  }, []);

  const getPasswordRequirements = () => {
    return {
      hasMinLength: newPassword.length >= 8,
      hasUppercase: /[A-Z]/.test(newPassword),
      hasLowercase: /[a-z]/.test(newPassword),
      hasNumber: /[0-9]/.test(newPassword),
      hasSpecial: /[^A-Za-z0-9]/.test(newPassword),
    };
  };

  const getPasswordStrength = () => {
    const reqs = getPasswordRequirements();
    return [reqs.hasMinLength, reqs.hasUppercase, reqs.hasLowercase, reqs.hasNumber, reqs.hasSpecial].filter(Boolean).length;
  };

  const getStrengthLabel = (score: number) => {
    if (newPassword.length === 0) return '';
    if (score <= 2) return 'Weak';
    if (score <= 3) return 'Fair';
    if (score === 4) return 'Strong';
    return 'Very Strong';
  };

  const getStrengthColor = (score: number) => {
    if (score <= 2) return '#ef4444';
    if (score <= 3) return '#f59e0b';
    if (score === 4) return '#22c55e';
    return '#3b82f6';
  };

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    
    const score = getPasswordStrength();
    if (score < 5) {
      // In web app, all 5 criteria are needed for it to be not weak (or at least score 5 is very strong, but the validator requires all 5)
      const isStrong = newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) && /[0-9]/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword);
      if (!isStrong) {
        Alert.alert('Weak Password', 'Password must be at least 8 characters long and contain uppercase, lowercase, numbers, and special characters.');
        return;
      }
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'User profile not found. Please log in again.');
      return;
    }

    try {
      setIsSubmitting(true);
      
      const payload = {
        ID: Number(user.id),
        NameInFull: user.fullName || '',
        NameWithInitials: user.nameWithInitials || user.fullName || '',
        Username: user.username,
        Password: newPassword,
        NIC: user.nic || user.NIC || '',
        ContactNo: user.phone || user.contactNo || '',
        Birthday: user.birthday || null,
        SabhaID: user.sabhaId || null,
        OfficeID: user.officeId || null,
        ActiveStatus: user.activeStatus ?? 1,
        GenderID: user.genderId || null,
        ProfilePicPath: user.profilePicPath || null,
        IsAdmin: user.isAdmin ? 1 : 0,
        IsRI: 0,
        OrganizationTypeId: user.organizationTypeId || null,
        NonLA_OfficeId: user.nonLaOfficeId || null,
        ProvinceID: user.provinceId || null,
        RoleId: user.roleId || null,
        DepartmentId: user.departmentId || null,
      };

      await UserService.updateUser(payload);
      
      Alert.alert(
        'Success', 
        'Your password has been changed successfully. You will be logged out now.',
        [{ text: 'OK', onPress: () => {
          AuthService.logout().then(() => {
            DeviceEventEmitter.emit('LOGOUT');
          });
        }}]
      );

    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const score = getPasswordStrength();
  const strengthLabel = getStrengthLabel(score);
  const strengthColor = getStrengthColor(score);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F4C81" />
      
      {/* Blue Background Cover */}
      <View style={styles.blueHeaderBg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CHANGE PASSWORD</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.title}>Change Password</Text>
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>ℹ️ You will be automatically signed out after changing your password.</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Current Password</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrent}
                placeholder="Enter your current password"
                placeholderTextColor="#94a3b8"
              />
              <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showCurrent ? 'HIDE' : 'SHOW'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNew}
                placeholder="Enter new password"
                placeholderTextColor="#94a3b8"
              />
              <TouchableOpacity onPress={() => setShowNew(!showNew)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showNew ? 'HIDE' : 'SHOW'}</Text>
              </TouchableOpacity>
            </View>
            
            {newPassword.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBars}>
                  <View style={[styles.strengthBar, score >= 1 && { backgroundColor: strengthColor }]} />
                  <View style={[styles.strengthBar, score >= 2 && { backgroundColor: strengthColor }]} />
                  <View style={[styles.strengthBar, score >= 3 && { backgroundColor: strengthColor }]} />
                  <View style={[styles.strengthBar, score >= 4 && { backgroundColor: strengthColor }]} />
                  <View style={[styles.strengthBar, score >= 5 && { backgroundColor: strengthColor }]} />
                </View>
                <Text style={[styles.strengthText, { color: strengthColor }]}>{strengthLabel}</Text>
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm New Password</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                placeholder="Confirm your new password"
                placeholderTextColor="#94a3b8"
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showConfirm ? 'HIDE' : 'SHOW'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.requirementsBox}>
            <Text style={styles.reqTitle}>Password requirements</Text>
            <View style={styles.reqList}>
              {renderReqItem(getPasswordRequirements().hasMinLength, 'At least 8 characters')}
              {renderReqItem(getPasswordRequirements().hasUppercase, 'One uppercase letter (A-Z)')}
              {renderReqItem(getPasswordRequirements().hasLowercase, 'One lowercase letter (a-z)')}
              {renderReqItem(getPasswordRequirements().hasNumber, 'One number (0-9)')}
              {renderReqItem(getPasswordRequirements().hasSpecial, 'One special character (!@#$...)')}
            </View>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} 
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.submitText}>Update Password</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.clearButton} 
              onPress={() => {
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
              }}
              disabled={isSubmitting}
            >
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const renderReqItem = (met: boolean, text: string) => (
  <View style={styles.reqItem}>
    <Text style={[styles.reqIcon, met && styles.reqIconMet]}>{met ? '✅' : '○'}</Text>
    <Text style={[styles.reqText, met && styles.reqTextMet]}>{text}</Text>
  </View>
);

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
  scrollContent: {
    flex: 1,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 20,
    padding: 24,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  noticeBox: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  noticeText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
  },
  eyeBtn: {
    padding: 8,
  },
  eyeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F4C81',
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  strengthBars: {
    flexDirection: 'row',
    flex: 1,
    gap: 4,
    marginRight: 12,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '700',
    width: 85,
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  requirementsBox: {
    marginTop: 8,
    marginBottom: 24,
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  reqTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reqList: {
    gap: 8,
  },
  reqItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reqIcon: {
    fontSize: 12,
    color: '#94a3b8',
    marginRight: 8,
    width: 16,
    textAlign: 'center',
  },
  reqIconMet: {
    color: '#22c55e',
  },
  reqText: {
    fontSize: 13,
    color: '#64748b',
  },
  reqTextMet: {
    color: '#334155',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#0F4C81',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  clearText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
  }
});
