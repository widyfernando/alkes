import axios from 'axios';
import Sentry from '../sentry';
import { clearAuthSession, getAuthToken } from './authStorage';

let authAlertShown = false;
let accessAlertShown = false;

const showAccessAlert = async (title, text, icon = 'warning', options = {}) => {
  try {
    const Swal = (await import('sweetalert2')).default;
    return Swal.fire({
      icon,
      title,
      text,
      confirmButtonText: 'OK',
      allowOutsideClick: false,
      allowEscapeKey: false,
      ...options,
    });
  } catch {
    window.alert(`${title}\n${text}`);
    return { isConfirmed: true };
  }
};

const apiBaseUrl = (process.env.REACT_APP_API_URL || '')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/login$/i, '');

const API = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

API.interceptors.request.use(
  (config) => {
    const token = getAuthToken();

    if (config.skipAuth) {
      delete config.headers.Authorization;
    } else if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers.Authorization) {
      delete config.headers.Authorization;
    }

    if (config.method?.toLowerCase() === 'get') {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

API.interceptors.response.use(
  async (response) => {
    const message = response.data?.message || '';

    if (response.data?.status === 2 && /hak akses/i.test(message) && !accessAlertShown) {
      accessAlertShown = true;
      await showAccessAlert('Akses Ditolak', message, 'error');
      accessAlertShown = false;
    }

    return response;
  },
  async (error) => {
    const status = error.response?.status;

    if (!status || status >= 500) {
      Sentry.captureException(error, {
        tags: { layer: 'api', status: status || 'network' },
        extra: { method: error.config?.method, url: error.config?.url },
      });
    }

    if (status === 401) {
      if (!authAlertShown) {
        authAlertShown = true;
        const result = await showAccessAlert(
          'Sesi Login Berakhir',
          error.response?.data?.message || 'Token tidak valid atau sesi Anda sudah kedaluwarsa. Silakan login ulang.',
          'warning',
          {
            confirmButtonText: 'Login Ulang',
            showCancelButton: true,
            cancelButtonText: 'Tetap di Halaman',
          }
        );

        if (!result.isConfirmed) {
          authAlertShown = false;
          return Promise.reject(error);
        }
      }

      clearAuthSession();

      if (window.location.pathname !== '/') {
        window.location.replace('/');
      }
    } else if (status === 403) {
      await showAccessAlert(
        'Akses Ditolak',
        error.response?.data?.message || 'Anda tidak memiliki hak akses untuk membuka menu atau menjalankan aksi ini.',
        'error'
      );
    }

    return Promise.reject(error);
  }
);

export default API;
