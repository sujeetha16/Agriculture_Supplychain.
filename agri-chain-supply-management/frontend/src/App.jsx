// Path: frontend/src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WalletProvider } from "./context/WalletContext";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import RegisterRole from "./pages/RegisterRole";
import Dashboard from "./pages/Dashboard";
import FarmerAddProduct from "./pages/FarmerAddProduct";
import ProductActions from "./pages/ProductActions";
import TraceProduct from "./pages/TraceProduct";
import ScanQR from "./pages/ScanQR";

export default function App() {
  return (
    <BrowserRouter>
      <WalletProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/register" element={<RegisterRole />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/farmer/add" element={<FarmerAddProduct />} />
            <Route path="/product/:productId" element={<ProductActions />} />
            <Route path="/trace" element={<TraceProduct />} />
            <Route path="/trace/:productId" element={<TraceProduct />} />
            <Route path="/scan" element={<ScanQR />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </WalletProvider>
    </BrowserRouter>
  );
}
