import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
});

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only treat 401 as an expired session when a token was stored — a failed
    // login attempt also returns 401 and must stay on the login page.
    if (
      typeof window !== 'undefined' &&
      error?.response?.status === 401 &&
      localStorage.getItem('token')
    ) {
      localStorage.removeItem('token');
      // Full-page navigation also discards the in-memory React Query cache
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
