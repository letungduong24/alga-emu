export interface Game {
  id: string;
  title: string;
  description: string;
  /** ID của emulator trong EMULATORS[] */
  emulatorId: string;
  /** Link tải ROM (có thể là .zip) */
  downloadUrl: string;
  /** Tên file ROM sau khi giải nén (ví dụ: white.nds) */
  romFileName: string;
  /** Ảnh bìa game */
  image: any;
}

export interface GameLibrary {
  emulatorId: string;
  games: Game[];
}

// Danh sách game NDS (mock trước, sau này có thể fetch từ JSON online)
export const NDS_GAMES: Game[] = [
  {
    id: 'pokemon-white',
    title: 'Pokémon White',
    description: 'Thế giới Pokémon Gen 5 - Vùng đất Unova huyền thoại',
    emulatorId: 'desmume',
    downloadUrl: 'https://duongle.dev/white.zip',
    romFileName: 'white.nds',
    image: require('@/assets/games/white.jpg'),
  },
];

// Map emulatorId -> danh sách game
export const GAME_LIBRARY: Record<string, Game[]> = {
  desmume: NDS_GAMES,
};
