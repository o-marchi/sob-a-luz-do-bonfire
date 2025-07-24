import axios, { type AxiosInstance } from 'axios'
import { useAuthStore } from '@/stores/auth.ts'

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const auth = useAuthStore();

  if (auth.jwt) {
    config.headers.Authorization = `Bearer ${auth.jwt}`;
  }

  config.headers['Content-Type'] = 'application/json';

  return config;
})

export default api;
