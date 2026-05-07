import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useState } from 'react';
import { copyFile, createDirectory, deleteFileOrDir, extract3dsIcon, extractNdsIcon, fileExists } from '../../modules/app-launcher';
import { useDownloadManager } from './useDownloadManager';
import { ApiGame } from './useGameApi';

// === Platform Configuration ===
interface PlatformConfig {
  emulatorId: string;
  extensions: string[];
  extractIcon: boolean;
  platform: 'gba' | 'nds' | '3ds';
}

const PLATFORM_CONFIG: Record<string, PlatformConfig> = {
  gba: {
    emulatorId: 'mgba',
    extensions: ['.gba'],
    extractIcon: false,
    platform: 'gba',
  },
  nds: {
    emulatorId: 'melonds', // or 'desmume'
    extensions: ['.nds'],
    extractIcon: true,
    platform: 'nds',
  },
  '3ds': {
    emulatorId: 'citra',
    extensions: ['.3ds', '.cci', '.cxi', '.3dsx'],
    extractIcon: true,
    platform: '3ds',
  },
};

// === Types ===
export type ImportOperation = 
  | 'idle'
  | 'validating'
  | 'copying'
  | 'extracting'
  | 'processing'
  | 'done';

export interface ImportState {
  isImporting: boolean;
  progress: number; // 0-1
  currentOperation: ImportOperation;
  error: string | null;
}

export interface ImportResult {
  success: boolean;
  game?: ApiGame;
  sourceFilePath?: string;
  error?: string;
}

export interface UseGameImportReturn {
  importState: ImportState;
  startImport: (emulatorId: string) => Promise<ImportResult>;
  cancelImport: () => void;
  deleteSourceFile: (filePath: string) => Promise<boolean>;
}

// === Validation ===
interface ValidationResult {
  valid: boolean;
  platform?: 'gba' | 'nds' | '3ds';
  emulatorId?: string;
  error?: string;
}

function validateFile(filename: string, expectedPlatform?: 'gba' | 'nds' | '3ds'): ValidationResult {
  const lowerFilename = filename.toLowerCase();
  
  // Check against platform configurations
  for (const [platformKey, config] of Object.entries(PLATFORM_CONFIG)) {
    for (const ext of config.extensions) {
      if (lowerFilename.endsWith(ext)) {
        return {
          valid: true,
          platform: config.platform,
          emulatorId: config.emulatorId,
        };
      }
    }
  }
  
  // No valid extension found - generate specific error message
  let errorMessage = 'Định dạng file không được hỗ trợ.';
  
  if (expectedPlatform) {
    const platformExtensions: Record<string, string> = {
      'gba': '.gba',
      'nds': '.nds',
      '3ds': '.3ds, .cci, .cxi, .3dsx'
    };
    const platformNames: Record<string, string> = {
      'gba': 'Game Boy Advance',
      'nds': 'Nintendo DS',
      '3ds': 'Nintendo 3DS'
    };
    errorMessage = `Định dạng file không hợp lệ cho ${platformNames[expectedPlatform]}. Vui lòng chọn file ${platformExtensions[expectedPlatform]}`;
  } else {
    errorMessage = 'Định dạng file không được hỗ trợ. Vui lòng chọn file .gba, .nds, .3ds, .cci, .cxi hoặc .3dsx';
  }
  
  return {
    valid: false,
    error: errorMessage,
  };
}

// === Metadata Generation ===
function generateGameId(filename: string): number {
  // Generate stable negative ID from filename hash
  let hash = 0;
  const cleanName = filename.replace(/\.zip$/i, '');
  
  for (let i = 0; i < cleanName.length; i++) {
    hash = ((hash << 5) - hash + cleanName.charCodeAt(i)) | 0;
  }
  
  // Return negative ID in range -100000000 to -999999999
  return -(Math.abs(hash) % 900000000 + 100000000);
}

function cleanGameName(filename: string): string {
  return filename
    .replace(/\.zip$/i, '')           // Remove .zip extension
    .replace(/\.(gba|nds|3ds|cci|cxi|3dsx)$/i, '') // Remove ROM extension
    .replace(/^\d+\s*-\s*/, '')       // Remove "0001 - " prefix
    .replace(/\s*\(.*?\)\s*/g, ' ')   // Remove (USA), (Europe), etc.
    .replace(/\s*\[.*?\]\s*/g, ' ')   // Remove [!], [a], etc.
    .trim();
}

function generateGameMetadata(filename: string, platform: 'gba' | 'nds' | '3ds', romPath: string): ApiGame {
  const id = generateGameId(filename);
  const name = cleanGameName(filename);
  
  return {
    id,
    name,
    platform,
    filename: filename.endsWith('.zip') ? filename : `${filename}.zip`,
    downloadUrl: '',
    size: 0,
  };
}

// === File Operations ===
async function generateUniqueFolderName(baseDir: string, baseName: string): Promise<string> {
  let folderName = baseName;
  let counter = 1;
  
  while (await fileExists(`${baseDir}/${folderName}`)) {
    folderName = `${baseName}_${counter}`;
    counter++;
  }
  
  return folderName;
}

async function copyRomFile(sourceUri: string, destDir: string, filename: string): Promise<string> {
  try {
    // Create destination directory
    await createDirectory(destDir);
    
    // Construct destination path
    const destPath = `${destDir}/${filename}`;
    
    // Handle content:// URIs from DocumentPicker
    if (sourceUri.startsWith('content://')) {
      const FileSystem = require('expo-file-system/legacy');
      
      // Step 1: Copy from content URI to cache first (expo-file-system can write to cache)
      const cacheDir = FileSystem.cacheDirectory;
      const tempPath = `${cacheDir}temp_import_${Date.now()}_${filename}`;
      
      await FileSystem.copyAsync({
        from: sourceUri,
        to: tempPath
      });
      
      // Step 2: Copy from cache to destination using native copyFile
      const tempFilePath = tempPath.replace('file://', '');
      await copyFile(tempFilePath, destPath);
      
      // Step 3: Cleanup temp file
      try {
        await FileSystem.deleteAsync(tempPath, { idempotent: true });
      } catch (e) {
        console.warn('Failed to cleanup temp file:', e);
      }
    } else {
      // Use native copyFile for file:// URIs
      const filePath = sourceUri.replace('file://', '');
      await copyFile(filePath, destPath);
    }
    
    return destPath;
  } catch (error: any) {
    throw new Error(`Không thể sao chép file ROM: ${error.message}`);
  }
}


// === Cover Image Extraction ===
const COVER_DIR = '/storage/emulated/0/Alga/covers';

async function extractIconSilently(romPath: string, gameId: number, platform: 'gba' | 'nds' | '3ds'): Promise<void> {
  try {
    // Skip extraction for GBA
    if (platform === 'gba') {
      return;
    }
    
    // Create covers directory
    await createDirectory(COVER_DIR);
    
    // Determine cover path
    const coverPath = `${COVER_DIR}/${gameId}.png`;
    
    // Extract icon based on platform
    if (platform === 'nds') {
      await extractNdsIcon(romPath, coverPath);
    } else if (platform === '3ds') {
      await extract3dsIcon(romPath, coverPath);
    }
  } catch (error) {
    // Log but don't throw - icon extraction is non-critical
    console.warn(`Icon extraction failed for game ${gameId}:`, error);
  }
}

// === Hook ===
export function useGameImport(): UseGameImportReturn {
  const downloadManager = useDownloadManager();
  
  const [importState, setImportState] = useState<ImportState>({
    isImporting: false,
    progress: 0,
    currentOperation: 'idle',
    error: null,
  });

  const updateState = useCallback((updates: Partial<ImportState>) => {
    setImportState((prev) => ({ ...prev, ...updates }));
  }, []);

  const startImport = useCallback(async (emulatorId: string): Promise<ImportResult> => {
    let destDir: string | null = null;
    
    try {
      // Update state to validating
      updateState({ isImporting: true, currentOperation: 'validating', progress: 0.1, error: null });
      
      // Determine expected platform for this emulator
      const emulatorPlatformMap: Record<string, 'gba' | 'nds' | '3ds'> = {
        'mgba': 'gba',
        'melonds': 'nds',
        'desmume': 'nds',
        'citra': '3ds'
      };
      
      const expectedPlatform = emulatorPlatformMap[emulatorId];
      if (!expectedPlatform) {
        updateState({ isImporting: false, currentOperation: 'idle', progress: 0, error: 'Emulator không hợp lệ' });
        return { success: false, error: 'Emulator không hợp lệ' };
      }
      
      // Open file picker
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/octet-stream', // For ROM files only
        copyToCacheDirectory: false,
      });
      
      // Handle cancellation
      if (result.canceled || !result.assets?.length) {
        updateState({ isImporting: false, currentOperation: 'idle', progress: 0 });
        return { success: false };
      }
      
      const file = result.assets[0];
      const filename = file.name;
      const sourceUri = file.uri;
      
      // Validate file
      const validation = validateFile(filename, expectedPlatform);
      if (!validation.valid) {
        updateState({ isImporting: false, currentOperation: 'idle', progress: 0, error: validation.error });
        return { success: false, error: validation.error };
      }
      
      if (!validation.platform) {
        updateState({ isImporting: false, currentOperation: 'idle', progress: 0, error: 'Không thể xác định platform từ file' });
        return { success: false, error: 'Không thể xác định platform từ file' };
      }
      
      const platform = validation.platform;
      
      // Validate platform matches emulator
      if (platform !== expectedPlatform) {
        const platformNames: Record<string, string> = {
          'gba': 'Game Boy Advance',
          'nds': 'Nintendo DS',
          '3ds': 'Nintendo 3DS'
        };
        updateState({ 
          isImporting: false, 
          currentOperation: 'idle', 
          progress: 0, 
          error: `File này là ROM ${platformNames[platform]}, không thể import vào thư viện ${platformNames[expectedPlatform]}` 
        });
        return { 
          success: false, 
          error: `File này là ROM ${platformNames[platform]}, không thể import vào thư viện ${platformNames[expectedPlatform]}` 
        };
      }
      
      const ROMS_BASE = '/storage/emulated/0/Alga/roms';
      
      // Check if folder already exists (means game already imported)
      const baseName = filename.replace(/\.(gba|nds|3ds|cci|cxi|3dsx)$/i, '');
      const checkDir = `${ROMS_BASE}/${emulatorId}/${baseName}`;
      
      const folderExists = await fileExists(checkDir);
      if (folderExists) {
        updateState({ isImporting: false, currentOperation: 'idle', progress: 0, error: 'Game này đã có trong thư viện' });
        return { success: false, error: 'Game này đã có trong thư viện' };
      }
      
      // Handle raw ROM file
      updateState({ currentOperation: 'copying', progress: 0.3 });
      
      // Use baseName already calculated above
      destDir = `${ROMS_BASE}/${emulatorId}/${baseName}`;
      
      // Copy ROM file
      const romPath = await copyRomFile(sourceUri, destDir, filename);
      
      // Metadata processing
      updateState({ currentOperation: 'processing', progress: 0.7 });
      
      // Generate game metadata
      const game = generateGameMetadata(filename, platform, romPath);
      
      // Add to downloaded games via downloadManager
      await downloadManager.scanLocalLibrary(emulatorId, PLATFORM_CONFIG[platform].extensions);
      
      // Extract icon silently (non-blocking)
      extractIconSilently(romPath, game.id, platform).catch(() => {
        console.warn('Icon extraction failed but import continues');
      });
      
      // Update state to done and reset after a short delay
      updateState({ currentOperation: 'done', progress: 1.0 });
      
      // Reset import state after showing "done" briefly
      setTimeout(() => {
        updateState({ isImporting: false, currentOperation: 'idle', progress: 0 });
      }, 500);
      
      // Return success with game and source file path
      return { 
        success: true, 
        game, 
        sourceFilePath: sourceUri 
      };
      
    } catch (error: any) {
      // Cleanup partial import
      if (destDir) {
        try {
          await deleteFileOrDir(destDir);
        } catch (cleanupError) {
          console.warn('Failed to cleanup partial import:', cleanupError);
        }
      }
      
      // Map error to user-friendly message
      let userMessage = error.message || 'Đã xảy ra lỗi không xác định';
      
      if (error.message?.includes('Không đủ dung lượng')) {
        userMessage = 'Không đủ dung lượng lưu trữ';
      } else if (error.message?.includes('Permission denied') || error.message?.includes('quyền')) {
        userMessage = 'Không có quyền truy cập file';
      }
      
      updateState({ isImporting: false, currentOperation: 'idle', progress: 0, error: userMessage });
      return { success: false, error: userMessage };
    }
  }, [updateState, downloadManager]);

  const cancelImport = useCallback(() => {
    setImportState({
      isImporting: false,
      progress: 0,
      currentOperation: 'idle',
      error: null,
    });
  }, []);

  const deleteSourceFile = useCallback(async (filePath: string): Promise<boolean> => {
    try {
      if (filePath.startsWith('content://')) {
        // Try to delete content URI using expo-file-system
        const FileSystem = require('expo-file-system/legacy');
        
        try {
          // Try to get file info first
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(filePath, { idempotent: true });
            return true;
          }
        } catch (e) {
          // If expo-file-system can't handle it, content URI can't be deleted
          console.log('Cannot delete content:// URI:', e);
          return false;
        }
      } else {
        // Delete file:// path using native function
        const cleanPath = filePath.replace('file://', '');
        await deleteFileOrDir(cleanPath);
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('Failed to delete source file:', error);
      return false;
    }
  }, []);

  return {
    importState,
    startImport,
    cancelImport,
    deleteSourceFile,
  };
}
