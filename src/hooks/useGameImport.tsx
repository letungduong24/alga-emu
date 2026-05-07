import { useCallback, useState } from 'react';
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

function validateFile(filename: string): ValidationResult {
  const lowerFilename = filename.toLowerCase();
  
  // Check if it's a ZIP file
  if (lowerFilename.endsWith('.zip')) {
    return { valid: true }; // ZIP files need further validation after extraction
  }
  
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
  
  // No valid extension found
  return {
    valid: false,
    error: 'Định dạng file không được hỗ trợ. Vui lòng chọn file .gba, .nds, .3ds, .cci, .cxi, .3dsx hoặc .zip',
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
    
    // Copy file from source URI to destination
    await copyFile(sourceUri, destPath);
    
    return destPath;
  } catch (error: any) {
    throw new Error(`Không thể sao chép file ROM: ${error.message}`);
  }
}

async function extractZipFile(zipUri: string, destDir: string): Promise<string[]> {
  try {
    // Create destination directory
    await createDirectory(destDir);
    
    // Extract ZIP
    await unzip(zipUri, destDir);
    
    // Find ROM files in extracted content
    const allFiles = await listFiles(destDir);
    const romFiles = allFiles.filter((file: string) => {
      const ext = file.toLowerCase();
      return ext.endsWith('.gba') || 
             ext.endsWith('.nds') || 
             ext.endsWith('.3ds') ||
             ext.endsWith('.cci') ||
             ext.endsWith('.cxi') ||
             ext.endsWith('.3dsx');
    });
    
    if (romFiles.length === 0) {
      throw new Error('NO_VALID_ROMS');
    }
    
    return romFiles;
  } catch (error: any) {
    if (error.message === 'NO_VALID_ROMS') {
      throw new Error('File ZIP không chứa ROM hợp lệ');
    }
    throw new Error(`Không thể giải nén file ZIP. File có thể bị hỏng: ${error.message}`);
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
    // TODO: Implement import workflow
    return { success: false, error: 'Not implemented yet' };
  }, []);

  const cancelImport = useCallback(() => {
    setImportState({
      isImporting: false,
      progress: 0,
      currentOperation: 'idle',
      error: null,
    });
  }, []);

  const deleteSourceFile = useCallback(async (filePath: string): Promise<boolean> => {
    // TODO: Implement source file deletion
    return false;
  }, []);

  return {
    importState,
    startImport,
    cancelImport,
    deleteSourceFile,
  };
}
