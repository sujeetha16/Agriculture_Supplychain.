// Path: frontend/src/components/Layout.jsx
import React from "react";
import { Link, NavLink } from "react-router-dom";
import { useWallet } from "../context/WalletContext";

export default function Layout({ children }) {
  const { address, isSepolia, connecting, connect } = useWallet();

  return (
    <>
      <nav className="navbar navbar-expand-lg bg-dark navbar-dark sticky-top shadow-sm">
        <div className="container">
          <Link className="navbar-brand fw-bold" to="/">
            <i className="bi bi-leaf me-2"></i>AgriChain
          </Link>

          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav">
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse" id="mainNav">
            <div className="navbar-nav me-auto">
              <NavLink className="nav-link" to="/">Home</NavLink>
              <NavLink className="nav-link" to="/trace">Trace Product</NavLink>
            </div>

            <div className="d-flex align-items-center gap-2">
              {address && (
                <span className={`badge ${isSepolia ? "text-bg-success" : "text-bg-warning"}`}>
                  {isSepolia ? "Sepolia" : "Wrong Network"}
                </span>
              )}
              <button className="btn btn-outline-light btn-sm" onClick={connect} disabled={connecting}>
                {connecting ? "Connecting..." : address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Connect MetaMask"}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main>{children}</main>

      <footer className="bg-dark text-white mt-5 py-4">
        <div className="container text-center small">
          AgriChain • Ethereum Sepolia • MongoDB • React
        </div>
      </footer>
    </>
  );
}
