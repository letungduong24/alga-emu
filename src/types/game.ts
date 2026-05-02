export interface Game {
  id: string;
  title: string;
  description: string;
  posterUrl: string;
  emulatorName: string;
  emulatorPackage: string;
  romExtensions: string[];
  apkUrl: string;
}
