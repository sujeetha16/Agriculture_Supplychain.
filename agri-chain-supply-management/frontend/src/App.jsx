// Path: frontend/src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WalletProvider } from "./context/WalletContext";
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

export default function App() {
  return (
    <BrowserRouter>
      <WalletProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/farmer/add" element={<FarmerAddProduct />} />
            <Route path="/product/:productId" element={<ProductActions />} />
            <Route path="/trace" element={<TraceProduct />} />
            <Route path="/trace/:productId" element={<TraceProduct />} />
            <Route path="/scan" element={<ScanQR />} />
            <Route path="/cloud-architecture" element={<CloudArchitecture />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </WalletProvider>
    </BrowserRouter>
  );
}
