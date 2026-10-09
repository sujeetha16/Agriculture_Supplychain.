// Path: frontend/src/context/WalletContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { connectWallet, SEPOLIA_CHAIN_ID, DEMO_PERSONAS } from "../services/blockchain";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [metaMaskAddress, setMetaMaskAddress] = useState("");
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoRole, setDemoRole] = useState(1); // Default to Farmer in demo mode

  async function refreshMetaMask() {
    if (!window.ethereum) return;
    try {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      const chain = await window.ethereum.request({ method: "eth_chainId" });
      setMetaMaskAddress(accounts[0] || "");
      setChainId(parseInt(chain, 16));
    } catch (_) {}
  }

  async function connect() {
    try {
      setConnecting(true);
      const account = await connectWallet();
      setMetaMaskAddress(account);
      setIsDemoMode(false);
      const chain = await window.ethereum.request({ method: "eth_chainId" });
      setChainId(parseInt(chain, 16));
    } finally {
      setConnecting(false);
    }
  }

  function disconnect() {
    setMetaMaskAddress("");
    setIsDemoMode(true);
  }

  function switchDemoRole(newRole) {
    setIsDemoMode(true);
    setDemoRole(Number(newRole));
  }

  function enableDemoMode() {
    setIsDemoMode(true);
  }

  useEffect(() => {
    refreshMetaMask();
    if (!window.ethereum) {
      // If MetaMask is absent, default to interactive demo mode for zero-friction evaluation
      setIsDemoMode(true);
      return;
    }

    const accountsChanged = (accs) => {
      setMetaMaskAddress(accs[0] || "");
    };
    const chainChanged = (c) => {
      setChainId(parseInt(c, 16));
    };

    window.ethereum.on("accountsChanged", accountsChanged);
    window.ethereum.on("chainChanged", chainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", accountsChanged);
      window.ethereum.removeListener("chainChanged", chainChanged);
    };
  }, []);

  const activeAddress = isDemoMode
    ? DEMO_PERSONAS[demoRole]?.address || ""
    : metaMaskAddress;

  const activeRole = isDemoMode ? demoRole : null;
  const currentPersona = isDemoMode ? DEMO_PERSONAS[demoRole] : null;

  return (
    <WalletContext.Provider value={{
      address: activeAddress,
      chainId,
      isSepolia: chainId === SEPOLIA_CHAIN_ID,
      connecting,
      connect,
      disconnect,
      isDemoMode,
      demoRole,
      currentPersona,
      switchDemoRole,
      enableDemoMode,
      setIsDemoMode,
      metaMaskAddress,
      hasMetaMask: Boolean(typeof window !== "undefined" && window.ethereum)
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
