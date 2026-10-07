// Path: frontend/src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { getProductsByWallet } from "../services/api";
import { getSignerAndContract } from "../services/blockchain";
import ProductCard from "../components/ProductCard";
import Alert from "../components/Alert";

const roleNames = { 1: "Farmer", 2: "Distributor", 3: "Retailer", 4: "Consumer" };

export default function Dashboard() {
  const { address } = useWallet();
  const [products, setProducts] = useState([]);
  const [role, setRole] = useState(0);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      if (!address) return;
      try {
        const { contract } = await getSignerAndContract();
        const chainRole = Number(await contract.getRole(address));
        setRole(chainRole);
        const data = await getProductsByWallet(address);
        setProducts(data);
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, [address]);

  if (!address) {
    return (
      <div className="container py-5 text-center">
        <h2>Connect MetaMask first</h2>
        <p className="text-secondary">Use the Connect MetaMask button in the navigation bar.</p>
      </div>
    );
  }

  if (role === 0) {
    return (
      <div className="container py-5 text-center">
        <h2 className="fw-bold">No role registered</h2>
        <p className="text-secondary">Register your wallet as Farmer, Distributor, Retailer or Consumer.</p>
        <button className="btn btn-success" onClick={() => navigate("/register")}>Register Role</button>
      </div>
    );
  }

  return (
    <div className="container py-5">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
        <div>
          <span className="badge text-bg-success mb-2">{roleNames[role]}</span>
          <h2 className="fw-bold mb-1">{roleNames[role]} Dashboard</h2>
          <div className="small text-secondary text-break">{address}</div>
        </div>
        {role === 1 && <Link className="btn btn-success" to="/farmer/add">+ Add Product</Link>}
      </div>

      <Alert message={error} />
      <div className="row g-4">
        {products.length ? products.map((product) => (
          <div className="col-md-6 col-lg-4" key={product.productId}>
            <ProductCard product={product} role={role} />
          </div>
        )) : (
          <div className="col-12">
            <div className="empty-state">No products are currently assigned to this wallet.</div>
          </div>
        )}
      </div>
    </div>
  );
}
