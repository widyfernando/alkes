// src/components/ProtectedRoute.js
import React from "react";
import { Navigate } from "react-router-dom";
import { isAuthenticated } from "../utils/authStorage";

const ProtectedRoute = ({ isLoggedIn, children }) => {
  if (!isLoggedIn || !isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
