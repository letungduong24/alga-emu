import { ImageSourcePropType } from 'react-native';

export interface Emulator {
  id: string;
  title: string;
  description: string;
  /** Core file cho LibretroDroid */
  coreName: string;
  /** URL tải core file */
  coreUrl: string;
  /** Các đuôi file ROM hỗ trợ */
  romExtension: string[];
  /** Ảnh đại diện hệ máy */
  image: any;
}

const CORE_BASE_URL = 'https://buildbot.libretro.com/nightly/android/latest/arm64-v8a/';

export const EMULATORS: Emulator[] = [
  {
    id: 'citra',
    title: 'Nintendo 3DS',
    description: 'Core Citra - Đồ họa 3D đỉnh cao',
    coreName: 'citra_libretro_android.so',
    coreUrl: `${CORE_BASE_URL}citra_libretro_android.so.zip`,
    romExtension: ['.3ds', '.cci', '.cxi'],
    image: require('@/assets/emulators/3ds.png'),
  },
  {
    id: 'desmume',
    title: 'Nintendo DS',
    description: 'Core DeSmuME 2015 - Ổn định trên Android',
    coreName: 'desmume2015_libretro_android.so',
    coreUrl: `${CORE_BASE_URL}desmume2015_libretro_android.so.zip`,
    romExtension: ['.nds'],
    image: require('@/assets/emulators/nds.png'),
  },
  {
    id: 'mgba',
    title: 'GameBoy Advance',
    description: 'Core mGBA - Tốc độ và độ chính xác cao',
    coreName: 'mgba_libretro_android.so',
    coreUrl: `${CORE_BASE_URL}mgba_libretro_android.so.zip`,
    romExtension: ['.gba'],
    image: require('@/assets/emulators/gba.png'),
  }
];
