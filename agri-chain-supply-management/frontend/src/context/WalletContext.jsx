// Path: frontend/src/context/WalletContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { connectWallet, SEPOLIA_CHAIN_ID } from "../services/blockchain";
import { STAKEHOLDERS, resolveStakeholder } from "../services/stakeholders";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  // Authentication State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("agri_current_user");
      return saved ? JSON.parse(saved) : STAKEHOLDERS[0]; // Default to Farmer on first load
    } catch (_) {
      return STAKEHOLDERS[0];
    }
  });

  // Blockchain / MetaMask State
  const [metaMaskAddress, setMetaMaskAddress] = useState("");
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [useMetaMaskSigner, setUseMetaMaskSigner] = useState(false);

  // Synchronize user to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("agri_current_user", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("agri_current_user");
    }
  }, [currentUser]);

  // Login function
  function login(username, password) {
    const ident = (username || "").toLowerCase().trim();
    const found = STAKEHOLDERS.find(
      (s) => s.username.toLowerCase() === ident || s.email.toLowerCase() === ident
    );

    if (found) {
      setCurrentUser(found);
      setUseMetaMaskSigner(false);
      return { success: true, user: found };
    }
    return { success: false, message: "User not found. Try: farmer, distributor, retailer, or consumer" };
  }

  // Quick 1-click Role Login
  function loginAsRole(roleNumber) {
    const found = STAKEHOLDERS.find((s) => s.role === Number(roleNumber));
    if (found) {
      setCurrentUser(found);
      setUseMetaMaskSigner(false);
      return found;
    }
    return null;
  }

  // Logout function
  function logout() {
    setCurrentUser(null);
    setUseMetaMaskSigner(false);
  }

  // MetaMask integration
  async function refreshMetaMask() {
    if (!window.ethereum) return;
    try {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      const chain = await window.ethereum.request({ method: "eth_chainId" });
      setMetaMaskAddress(accounts[0] || "");
      setChainId(parseInt(chain, 16));
    } catch (_) {}
  }

  async function connectMetaMask() {
    try {
      setConnecting(true);
      const account = await connectWallet();
      setMetaMaskAddress(account);
      setUseMetaMaskSigner(true);
      const chain = await window.ethereum.request({ method: "eth_chainId" });
      setChainId(parseInt(chain, 16));
    } finally {
      setConnecting(false);
    }
  }

  useEffect(() => {
    refreshMetaMask();
    if (!window.ethereum) return;

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

  // Effective active address
  const activeAddress = useMetaMaskSigner && metaMaskAddress
    ? metaMaskAddress
    : currentUser?.walletAddress || "";

  const activeRole = currentUser?.role || 0;

  return (
    <WalletContext.Provider value={{
      user: currentUser,
      isAuthenticated: Boolean(currentUser),
      login,
      loginAsRole,
      logout,
      role: activeRole,
      roleName: currentUser?.roleName || "Guest",
      address: activeAddress,
      chainId,
      isSepolia: chainId === SEPOLIA_CHAIN_ID,
      connecting,
      connect: connectMetaMask,
      connectMetaMask,
      metaMaskAddress,
      useMetaMaskSigner,
      setUseMetaMaskSigner,
      hasMetaMask: Boolean(typeof window !== "undefined" && window.ethereum),
      allStakeholders: STAKEHOLDERS,
      resolveStakeholder,
      // Backwards compatibility aliases
      isDemoMode: !useMetaMaskSigner,
      demoRole: activeRole,
      currentPersona: currentUser,
      switchDemoRole: loginAsRole
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
