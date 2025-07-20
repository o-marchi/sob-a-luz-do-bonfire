import axios, { type AxiosInstance } from 'axios'
import { useAuthStore } from '@/stores/auth.ts'

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const auth = useAuthStore();

  const token = auth.jwt ? auth.jwt : import.meta.env.VITE_API_TOKEN;

  config.headers.Authorization = `Bearer ${token}`;
  config.headers['Content-Type'] = 'application/json';

  return config;
})

export default api;
