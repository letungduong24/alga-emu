import { keepPreviousData, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useCallback, useState } from 'react';

const api = axios.create({
  baseURL: 'https://alga-api.duongle.dev',
  timeout: 15000,
});

export interface ApiGame {
  id: number;
  name: string;
  filename: string;
  platform: string;
  size: number;
  downloadUrl: string;
}

interface GamesResponse {
  games: ApiGame[];
  total: number;
  page: number;
  totalPages: number;
}

const fetchGames = async (
  platform: string,
  q: string,
  page: number,
  limit: number = 20
): Promise<GamesResponse> => {
  const { data } = await api.get<GamesResponse>('/api/games', {
    params: { platform, q, page, limit },
  });
  return data;
};

/**
 * Fetch a single game by ID
 */
export const fetchGameById = async (gameId: number): Promise<ApiGame | null> => {
  try {
    const { data } = await api.get<ApiGame>(`/api/games/${gameId}`);
    return data;
  } catch (error) {
    // Don't log error for negative IDs (local/imported games)
    if (gameId < 0) {
      return null;
    }
    console.error(`Failed to fetch game ${gameId}:`, error);
    return null;
  }
};

/**
 * Search for a game by filename and platform
 * Used during backup restore when game ID might be different
 */
export const fetchGameByFilename = async (filename: string, platform: string): Promise<ApiGame | null> => {
  try {
    // Remove .zip extension for comparison
    const filenameWithoutZip = filename.replace(/\.zip$/i, '');
    
    // Search with filename (without .zip)
    const { data } = await api.get<GamesResponse>('/api/games', {
      params: { 
        platform, 
        q: filenameWithoutZip,
        page: 1, 
        limit: 100 // Increase limit to get more results
      },
    });
    
    console.log(`Searching for game: filename="${filename}", platform="${platform}", found ${data.games.length} results`);
    
    // Find exact match by filename (case-insensitive)
    const exactMatch = data.games.find(g => 
      g.filename.toLowerCase() === filename.toLowerCase()
    );
    
    if (exactMatch) {
      console.log(`Found exact match: ${exactMatch.name} (ID: ${exactMatch.id})`);
      return exactMatch;
    }
    
    // If no exact match, try to find by filename without extension
    const similarMatch = data.games.find(g => 
      g.filename.replace(/\.zip$/i, '').toLowerCase() === filenameWithoutZip.toLowerCase()
    );
    
    if (similarMatch) {
      console.log(`Found similar match: ${similarMatch.name} (ID: ${similarMatch.id})`);
      return similarMatch;
    }
    
    console.warn(`No match found for filename: ${filename}`);
    return null;
  } catch (error) {
    console.error(`Failed to fetch game by filename ${filename}:`, error);
    return null;
  }
};

export const useGameApi = (platform: string = 'nds') => {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['games', platform, query, page],
    queryFn: () => fetchGames(platform, query, page),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000, // cache 5 phút
  });

  const search = useCallback((q: string) => {
    setQuery(q);
    setPage(1);
  }, []);

  const goToPage = useCallback((p: number) => {
    setPage(p);
  }, []);

  return {
    games: data?.games ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    totalPages: data?.totalPages ?? 1,
    query,
    loading: isLoading,
    fetching: isFetching,
    error: error ? (error as Error).message : null,
    search,
    goToPage,
  };
};
