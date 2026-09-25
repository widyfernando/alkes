// src/App.js
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router } from "react-router-dom";
import Swal from "sweetalert2";
import Sentry from "./sentry";
import AppRoutes from "./Router/AppRoutes";
import { clearAuthSession, getSessionExpiresAt, getStoredUser, isAuthenticated } from "./utils/authStorage";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    setIsLoggedIn(isAuthenticated());
    setCurrentUser(getStoredUser());
  }, []);

  useEffect(() => {
    const syncSession = () => {
      const authenticated = isAuthenticated();
      setIsLoggedIn(authenticated);
      setCurrentUser(authenticated ? getStoredUser() : null);
    };
    window.addEventListener("storage", syncSession);
    return () => window.removeEventListener("storage", syncSession);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return undefined;
    const expiresAt = getSessionExpiresAt();
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      clearAuthSession();
      setCurrentUser(null);
      setIsLoggedIn(false);
      return undefined;
    }

    const warningDelay = Math.max(0, remaining - 5 * 60 * 1000);
    const warningTimer = window.setTimeout(() => {
      Swal.fire({
        icon: "warning",
        title: "Sesi Segera Berakhir",
        text: "Sesi Anda akan berakhir dalam 5 menit. Simpan pekerjaan yang sedang dilakukan.",
        confirmButtonText: "Mengerti",
        confirmButtonColor: "#2563eb",
      });
    }, warningDelay);
    const expiryTimer = window.setTimeout(() => {
      clearAuthSession();
      setCurrentUser(null);
      setIsLoggedIn(false);
      Swal.fire({ icon: "info", title: "Sesi Berakhir", text: "Silakan login kembali untuk melanjutkan.", confirmButtonColor: "#2563eb" });
    }, remaining);

    return () => {
      window.clearTimeout(warningTimer);
      window.clearTimeout(expiryTimer);
    };
  }, [isLoggedIn]);

  useEffect(() => {
    Sentry.setUser(currentUser ? { id: currentUser.user_id, username: currentUser.username } : null);
  }, [currentUser]);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    clearAuthSession();
    setCurrentUser(null);
    setIsLoggedIn(false);
  };

  return (
    <Router>
      <AppRoutes
        isLoggedIn={isLoggedIn}
        user={currentUser}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
      />
    </Router>
  );
}

export default App;
