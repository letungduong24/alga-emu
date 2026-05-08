import { create } from 'zustand';

interface BackupRestoreStore {
  isBackingUp: boolean;
  isRestoring: boolean;
  progress: number;
  currentOperation: string;
  error: string | null;
  
  setIsBackingUp: (value: boolean) => void;
  setIsRestoring: (value: boolean) => void;
  setProgress: (value: number) => void;
  setCurrentOperation: (value: string) => void;
  setError: (value: string | null) => void;
  updateProgress: (progress: number, message: string) => void;
  resetState: () => void;
}

export const useBackupRestoreStore = create<BackupRestoreStore>((set) => ({
  isBackingUp: false,
  isRestoring: false,
  progress: 0,
  currentOperation: '',
  error: null,
  
  setIsBackingUp: (value) => set({ isBackingUp: value }),
  setIsRestoring: (value) => set({ isRestoring: value }),
  setProgress: (value) => set({ progress: value }),
  setCurrentOperation: (value) => set({ currentOperation: value }),
  setError: (value) => set({ error: value }),
  
  updateProgress: (progress, message) => set({ progress, currentOperation: message }),
  
  resetState: () => {
    console.log('Zustand resetState called');
    set({
      isBackingUp: false,
      isRestoring: false,
      progress: 0,
      currentOperation: '',
      error: null,
    });
  },
}));
