import API from '../utils/axiosInstance';
import { clearAuthSession, setAuthSession } from '../utils/authStorage';

export const loginUser = async (username, password) => {
  try {
    const response = await API.post('/login', {
      username,
      password,
    });

    if (response.data?.status === 1 && response.data?.token) {
      setAuthSession({
        token: response.data.token,
        user: response.data.user,
      });

      return response.data.user;
    }

    clearAuthSession();
    throw new Error(response.data?.message || 'Kredensial salah');
  } catch (error) {
    clearAuthSession();
    const message = error.response?.data?.message || error.message || 'Gagal terhubung ke server';
    throw new Error(message);
  }
};

export const logoutUser = () => {
  clearAuthSession();
};
