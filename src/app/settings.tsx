import { CustomAlert } from '@/components/CustomAlert';
import { useBackupRestore } from '@/hooks/useBackupRestore';
import { useBackupRestoreStore } from '@/stores/backupRestoreStore';
import { formatFileSize, formatTimestamp } from '@/types/backup';
import * as DocumentPicker from 'expo-document-picker';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { ArrowLeft, Calendar, Download, FileArchive, HardDrive, Trash2, Upload } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Modal,
  ScrollView, StatusBar,
  Text, TouchableOpacity,
  View
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY = '#00f2ff';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  // Use zustand store for global state
  const { isBackingUp, isRestoring, progress, currentOperation, error } = useBackupRestoreStore();
  
  const {
    createBackup,
    restoreBackup,
    listBackups,
    deleteBackup,
    backupList,
  } = useBackupRestore();

  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [selectedBackupPath, setSelectedBackupPath] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showRestoreComplete, setShowRestoreComplete] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{
    gamesDownloaded: number;
    gamesFailed: number;
    savesRestored: number;
  } | null>(null);
  const [showBackupComplete, setShowBackupComplete] = useState(false);
  const [backupResult, setBackupResult] = useState<{
    filePath: string;
    fileSize: number;
  } | null>(null);

  // Load backup list on mount
  useEffect(() => {
    listBackups();
  }, []);

  // Prevent back navigation and keep screen awake during backup only
  useEffect(() => {
    if (isBackingUp) {
      // Keep screen awake
      activateKeepAwakeAsync();
      
      // Prevent back button during backup only
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        Alert.alert(
          'Đang xử lý',
          'Backup đang chạy. Vui lòng đợi hoàn tất.',
          [{ text: 'OK' }]
        );
        return true; // Prevent default back behavior
      });
      
      return () => {
        backHandler.remove();
        deactivateKeepAwake();
      };
    }
  }, [isBackingUp]);

  // Handle create backup (always without covers)
  const handleCreateBackup = useCallback(async () => {
    try {
      const result = await createBackup(false); // Always false for covers
      
      // Show custom alert with result
      setBackupResult({
        filePath: result.filePath,
        fileSize: result.fileSize,
      });
      setShowBackupComplete(true);
      
      // Refresh backup list
      listBackups();
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể tạo backup');
    }
  }, [createBackup, listBackups]);

  // Handle restore backup
  const handleRestoreBackup = useCallback(async () => {
    if (!selectedBackupPath) return;
    
    try {
      setShowRestoreConfirm(false);
      
      // Start restore in background (non-blocking)
      restoreBackup(
        selectedBackupPath,
        (prog, msg) => {
          console.log(`Restore progress: ${Math.round(prog * 100)}% - ${msg}`);
        }
      ).then((result) => {
        // Show result when complete
        setRestoreResult({
          gamesDownloaded: 0,
          gamesFailed: 0,
          savesRestored: result.savesRestored,
        });
        setShowRestoreComplete(true);
        
        // Ensure state is reset (backup for setTimeout in hook)
        setTimeout(() => {
          console.log('Backup reset from settings.tsx');
          // Don't call resetState here as it might conflict with hook's setTimeout
        }, 3000);
      }).catch((error: any) => {
        Alert.alert('Lỗi', error.message || 'Không thể restore backup');
      });
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể restore backup');
    } finally {
      setSelectedBackupPath(null);
    }
  }, [selectedBackupPath, restoreBackup]);

  // Handle select backup file
  const handleSelectBackupFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: false,
      });
      
      if (result.canceled || !result.assets?.length) return;
      
      const file = result.assets[0];
      if (!file.name.endsWith('.zip')) {
        Alert.alert('Lỗi', 'Vui lòng chọn file backup (.zip)');
        return;
      }
      
      // Remove both file:// and content:// prefixes
      let filePath = file.uri;
      if (filePath.startsWith('file://')) {
        filePath = filePath.replace('file://', '');
      } else if (filePath.startsWith('content://')) {
        // For content:// URIs, decode the path
        // content://com.android.externalstorage.documents/document/primary%3AAlga%2Fbackups%2Ffile.zip
        // → /storage/emulated/0/Alga/backups/file.zip
        const decodedUri = decodeURIComponent(filePath);
        const match = decodedUri.match(/primary[:/](.+)$/);
        if (match) {
          filePath = `/storage/emulated/0/${match[1]}`;
        } else {
          Alert.alert('Lỗi', 'Không thể xác định đường dẫn file');
          return;
        }
      }
      
      setSelectedBackupPath(filePath);
      setShowRestoreConfirm(true);
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể chọn file');
    }
  }, []);

  // Handle delete backup
  const handleDeleteBackup = useCallback(async (filePath: string) => {
    try {
      const success = await deleteBackup(filePath);
      if (success) {
        Alert.alert('Thành công', 'Đã xóa backup');
      } else {
        Alert.alert('Lỗi', 'Không thể xóa backup');
      }
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Không thể xóa backup');
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteBackup]);

  return (
    <View className="flex-1 bg-black">
      <StatusBar hidden />
      
      {/* Header */}
      <View style={{ paddingTop: insets.top }} className="px-5 py-3 border-b border-white/10">
        <View className="flex-row items-center">
          <TouchableOpacity 
            onPress={() => {
              if (isBackingUp) {
                Alert.alert(
                  'Đang xử lý',
                  'Backup đang chạy. Vui lòng đợi hoàn tất.',
                  [{ text: 'OK' }]
                );
              } else {
                router.back();
              }
            }} 
            className="mr-3 p-2"
          >
            <ArrowLeft size={22} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Cài đặt</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {/* Backup/Restore Section */}
        <View className="px-5 py-6">
          <Text className="text-white text-lg font-bold mb-4">Sao lưu & Khôi phục</Text>
          
          {/* Create Backup Button */}
          <TouchableOpacity
            onPress={handleCreateBackup}
            disabled={isBackingUp || isRestoring}
            className="bg-white/10 border border-white/10 rounded-2xl p-4 mb-3 flex-row items-center"
            style={{ opacity: (isBackingUp || isRestoring) ? 0.5 : 1 }}
          >
            <View className="w-12 h-12 rounded-xl items-center justify-center mr-4" style={{ backgroundColor: PRIMARY + '20' }}>
              <Upload size={20} color="white" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-semibold text-base">Tạo Backup</Text>
              <Text className="text-white/40 text-xs mt-0.5">Sao lưu file saves</Text>
            </View>
          </TouchableOpacity>

          {/* Restore Backup Button */}
          <TouchableOpacity
            onPress={() => {
              if (isRestoring) {
                Alert.alert('Đang khôi phục', 'Vui lòng đợi phiên restore hiện tại hoàn tất');
                return;
              }
              handleSelectBackupFile();
            }}
            disabled={isBackingUp}
            className="bg-white/10 border border-white/10 rounded-2xl p-4 flex-row items-center"
            style={{ opacity: isBackingUp ? 0.5 : 1 }}
          >
            <View className="w-12 h-12 rounded-xl items-center justify-center mr-4 bg-emerald-500/20">
              <Download size={20} color="white" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-semibold text-base">Khôi phục Backup</Text>
              <Text className="text-white/40 text-xs mt-0.5">Restore file saves từ backup</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Progress Indicator */}
        {(isBackingUp || isRestoring) && (
          <Animated.View entering={FadeInDown.duration(300)} className="px-5 py-4 bg-white/5 mx-5 rounded-2xl mb-4">
            <View className="flex-row items-center mb-2">
              <ActivityIndicator size="small" color={PRIMARY} />
              <Text className="text-white font-semibold ml-3">
                {isBackingUp ? 'Đang tạo backup...' : 'Đang khôi phục...'}
              </Text>
            </View>
            <View className="bg-white/10 h-2 rounded-full overflow-hidden mb-2">
              <View
                className="h-full rounded-full"
                style={{ width: `${progress * 100}%`, backgroundColor: PRIMARY }}
              />
            </View>
            <Text className="text-white/60 text-xs">{currentOperation}</Text>
          </Animated.View>
        )}

        {/* Error Display */}
        {error && (
          <Animated.View entering={FadeInDown.duration(300)} className="px-5 py-4 bg-red-500/10 border border-red-500/20 mx-5 rounded-2xl mb-4">
            <Text className="text-red-400 font-semibold mb-1">Lỗi</Text>
            <Text className="text-red-300 text-xs">{error}</Text>
          </Animated.View>
        )}

        {/* Backup History */}
        <View className="px-5 py-6 border-t border-white/10">
          <Text className="text-white text-lg font-bold mb-4">Lịch sử Backup</Text>
          
          {backupList.length === 0 ? (
            <View className="items-center py-8">
              <FileArchive size={48} color="rgba(255,255,255,0.2)" />
              <Text className="text-white/40 text-sm mt-3">Chưa có backup nào</Text>
            </View>
          ) : (
            backupList.map((backup, index) => (
              <Animated.View
                key={backup.filePath}
                entering={FadeInDown.delay(index * 50).duration(300)}
                className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-3"
              >
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1 mr-3">
                    <Text className="text-white font-semibold text-sm mb-1" numberOfLines={1}>
                      {backup.fileName}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <Calendar size={12} color="rgba(255,255,255,0.4)" />
                      <Text className="text-white/40 text-xs ml-1.5">
                        {formatTimestamp(backup.createdAt)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setDeleteTarget(backup.filePath)}
                    className="p-2"
                  >
                    <Trash2 size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                
                <View className="flex-row items-center mt-2 pt-2 border-t border-white/5">
                  <View className="flex-row items-center mr-4">
                    <HardDrive size={12} color="rgba(255,255,255,0.4)" />
                    <Text className="text-white/60 text-xs ml-1.5">
                      {formatFileSize(backup.fileSize)}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <FileArchive size={12} color="rgba(255,255,255,0.4)" />
                    <Text className="text-white/60 text-xs ml-1.5">
                      {backup.gameCount} saves
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    if (isRestoring) {
                      Alert.alert('Đang khôi phục', 'Vui lòng đợi phiên restore hiện tại hoàn tất');
                      return;
                    }
                    setSelectedBackupPath(backup.filePath);
                    setShowRestoreConfirm(true);
                  }}
                  disabled={isBackingUp}
                  className="mt-3 py-2 rounded-xl items-center"
                  style={{ backgroundColor: PRIMARY + '20', opacity: isBackingUp ? 0.5 : 1 }}
                >
                  <Text className="font-semibold text-xs" style={{ color: PRIMARY }}>
                    Khôi phục
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Restore Confirm Modal */}
      <Modal
        visible={showRestoreConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRestoreConfirm(false)}
      >
        <TouchableOpacity
          className="flex-1 justify-center items-center"
          activeOpacity={1}
          onPress={() => setShowRestoreConfirm(false)}
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
        >
          <View className="bg-[#1a1a2e] rounded-3xl p-6 mx-6 w-full max-w-sm">
            <Text className="text-white text-xl font-bold mb-3">Xác nhận Restore</Text>
            <Text className="text-white/60 text-sm mb-6">
              Bạn có chắc muốn khôi phục backup này? File saves sẽ được khôi phục.
            </Text>
            
            <View className="flex-row gap-x-3">
              <TouchableOpacity
                onPress={() => setShowRestoreConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-white/10 items-center"
              >
                <Text className="text-white font-semibold">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRestoreBackup}
                className="flex-1 py-3 rounded-xl items-center"
                style={{ backgroundColor: PRIMARY }}
              >
                <Text className="text-black font-bold">Restore</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        visible={!!deleteTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
      >
        <TouchableOpacity
          className="flex-1 justify-center items-center"
          activeOpacity={1}
          onPress={() => setDeleteTarget(null)}
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
        >
          <View className="bg-[#1a1a2e] rounded-3xl p-6 mx-6 w-full max-w-sm">
            <Text className="text-white text-xl font-bold mb-3">Xóa Backup?</Text>
            <Text className="text-white/60 text-sm mb-6">
              Bạn có chắc muốn xóa backup này? Hành động này không thể hoàn tác.
            </Text>
            
            <View className="flex-row gap-x-3">
              <TouchableOpacity
                onPress={() => setDeleteTarget(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 items-center"
              >
                <Text className="text-white font-semibold">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => deleteTarget && handleDeleteBackup(deleteTarget)}
                className="flex-1 py-3 rounded-xl items-center bg-red-500"
              >
                <Text className="text-white font-bold">Xóa</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Restore Complete Alert */}
      <CustomAlert
        visible={showRestoreComplete}
        title="Restore hoàn tất"
        message={
          restoreResult
            ? `Saves khôi phục: ${restoreResult.savesRestored}`
            : ''
        }
        confirmText="OK"
        confirmColor="#00f2ff"
        onConfirm={() => {
          setShowRestoreComplete(false);
          setRestoreResult(null);
        }}
      />

      {/* Backup Complete Alert */}
      <CustomAlert
        visible={showBackupComplete}
        title="Backup thành công"
        message={
          backupResult
            ? `Đã tạo backup tại:\n${backupResult.filePath}\n\nKích thước: ${formatFileSize(backupResult.fileSize)}`
            : ''
        }
        confirmText="OK"
        confirmColor="#00f2ff"
        onConfirm={() => {
          setShowBackupComplete(false);
          setBackupResult(null);
        }}
      />
    </View>
  );
}
