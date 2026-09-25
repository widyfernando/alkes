const AUTH_TOKEN_KEY = "authToken";
const USER_KEY = "user";

export const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_KEY);

const decodeTokenPayload = (token) => {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(atob(normalized).split("").map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join("")));
  } catch {
    return null;
  }
};

export const getSessionExpiresAt = () => {
  const payload = decodeTokenPayload(getAuthToken() || "");
  return payload?.exp ? payload.exp * 1000 : 0;
};

export const getStoredUser = () => {
  const rawUser = localStorage.getItem(USER_KEY);

  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser);
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
};

export const setAuthSession = ({ token, user }) => {
  if (!token) {
    throw new Error("Token autentikasi tidak ditemukan");
  }

  localStorage.setItem(AUTH_TOKEN_KEY, token);

  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
};

export const clearAuthSession = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("isLoggedIn");
  sessionStorage.clear();
};

export const isAuthenticated = () => {
  const token = getAuthToken();
  const expiresAt = getSessionExpiresAt();
  if (!token || !expiresAt || expiresAt <= Date.now()) {
    if (token) clearAuthSession();
    return false;
  }
  return true;
};
