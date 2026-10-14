import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WalletProvider, useWallet } from "./context/WalletContext";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import RegisterRole from "./pages/RegisterRole";
import Dashboard from "./pages/Dashboard";
import FarmerAddProduct from "./pages/FarmerAddProduct";
import ProductActions from "./pages/ProductActions";
import TraceProduct from "./pages/TraceProduct";
import ScanQR from "./pages/ScanQR";
import CloudArchitecture from "./pages/CloudArchitecture";

function ProtectedRoute({ children }) {
  const { user } = useWallet();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function RootRoute() {
  const { user } = useWallet();
  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <WalletProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<RootRoute />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/farmer/add" element={<ProtectedRoute><FarmerAddProduct /></ProtectedRoute>} />
            <Route path="/product/:productId" element={<ProtectedRoute><ProductActions /></ProtectedRoute>} />
            <Route path="/trace" element={<ProtectedRoute><TraceProduct /></ProtectedRoute>} />
            <Route path="/trace/:productId" element={<ProtectedRoute><TraceProduct /></ProtectedRoute>} />
            <Route path="/scan" element={<ProtectedRoute><ScanQR /></ProtectedRoute>} />
            <Route path="/cloud-architecture" element={<ProtectedRoute><CloudArchitecture /></ProtectedRoute>} />
            <Route path="/about" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/register-role" element={<ProtectedRoute><RegisterRole /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </WalletProvider>
    </BrowserRouter>
  );
}
