/**
 * =============================================================================
 * API Client Configuration
 * =============================================================================
 * 
 * Centralized Axios instance for making API calls to the backend.
 * All API requests go through this client to ensure consistent
 * configuration (base URL, headers, etc.)
 * 
 * Environment:
 *   NEXT_RAILWAY_URL - Backend API URL (Railway production URL)
 */

import axios from 'axios';

// Backend URL: use NEXT_PUBLIC_API_URL in production, fallback to localhost in development
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

/**
 * Pre-configured Axios instance for API calls.
 * 
 * Usage:
 *   import { api } from '@/lib/api';
 *   const { data } = await api.get('/categories/navigations');
 */
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * SWR-compatible fetcher function.
 * Used with React Query or SWR for data fetching.
 */
export const fetcher = async (url: string) => {
  const response = await api.get(url);
  return response.data;
};