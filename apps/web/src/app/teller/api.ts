import axios from 'axios';
import { CreateDepositRequest, Member, Transaction } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Search for members by name, phone, or member number
 */
export async function searchMembers(query: string): Promise<Member[]> {
  try {
    const response = await apiClient.get('/api/v1/members', {
      params: {
        search: query,
        limit: 10,
      },
    });
    return response.data.data || [];
  } catch (error) {
    console.error('Failed to search members:', error);
    throw error;
  }
}

/**
 * Create a new deposit transaction
 */
export async function createDeposit(data: CreateDepositRequest): Promise<Transaction> {
  try {
    const response = await apiClient.post('/cashier/deposits', data);
    return response.data;
  } catch (error) {
    console.error('Failed to create deposit:', error);
    throw error;
  }
}

/**
 * Get a single deposit transaction by ID
 */
export async function getDeposit(id: string): Promise<Transaction> {
  try {
    const response = await apiClient.get(`/cashier/deposits/${id}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get deposit:', error);
    throw error;
  }
}

/**
 * List deposits with filters
 */
export async function listDeposits(params?: {
  transactionType?: string;
  channel?: string;
  fromDate?: string;
  toDate?: string;
  memberId?: string;
  limit?: number;
}): Promise<{ data: Transaction[]; meta: { count: number; limit: number } }> {
  try {
    const response = await apiClient.get('/cashier/deposits', { params });
    return response.data;
  } catch (error) {
    console.error('Failed to list deposits:', error);
    throw error;
  }
}
