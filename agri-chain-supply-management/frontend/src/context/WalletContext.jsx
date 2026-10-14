// Path: frontend/src/context/WalletContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { connectWallet, SEPOLIA_CHAIN_ID, getWalletRole, ROLE_NAMES, switchToSepolia } from "../services/blockchain";
import {
  STAKEHOLDERS,
  getAllStakeholders,
  saveCustomStakeholder,
  resolveStakeholder
} from "../services/stakeholders";
import { loginUser, registerUser } from "../services/api";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  // Authentication State: null by default so user must log in
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      // Clear persistent user from localStorage so that launching localhost starts strictly on login
      localStorage.removeItem("agri_current_user");
      const saved = sessionStorage.getItem("agri_current_user");
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  });

  // Stakeholders list including custom registered users
  const [stakeholdersList, setStakeholdersList] = useState(getAllStakeholders());

  function refreshStakeholders() {
    setStakeholdersList(getAllStakeholders());
  }

  // Blockchain / MetaMask State
  const [metaMaskAddress, setMetaMaskAddress] = useState("");
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [useMetaMaskSigner, setUseMetaMaskSigner] = useState(false);
  const [onChainRole, setOnChainRole] = useState(null);
  const [onChainRoleName, setOnChainRoleName] = useState("");
  const [loadingOnChainRole, setLoadingOnChainRole] = useState(false);
  const [onChainRoleError, setOnChainRoleError] = useState("");

  // Synchronize user to sessionStorage
  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem("agri_current_user", JSON.stringify(currentUser));
    } else {
      sessionStorage.removeItem("agri_current_user");
      localStorage.removeItem("agri_current_user");
    }
  }, [currentUser]);

  // Login function with backend authoritative authentication
  async function login(username, password) {
    const ident = (username || "").toLowerCase().trim();
    const cleanPassword = (password || "").trim();

    if (!ident || !cleanPassword) {
      return {
        success: false,
        message: "Both username and password are required."
      };
    }

    try {
      // 1. Authoritative Backend Authentication
      const res = await loginUser({ username: ident, password: cleanPassword });
      if (res && res.success && res.user) {
        saveCustomStakeholder(res.user);
        refreshStakeholders();
        setCurrentUser(res.user);
        setUseMetaMaskSigner(false);
        return { success: true, user: res.user };
      }
    } catch (apiErr) {
      // If the backend API responded with 400/401/403/etc., fail closed immediately.
      // A rejected login must NEVER silently trigger a successful local login.
      if (apiErr.response) {
        return {
          success: false,
          message: apiErr.response.data?.message || "Invalid username or password."
        };
      }
    }

    // In production, network failure or missing API must NOT fall back to local unverified accounts.
    if (import.meta.env.PROD) {
      return {
        success: false,
        message: "Backend authentication service is unavailable. Please verify network connectivity."
      };
    }

    // 2. Development-Only Offline Fallback (Sandbox / Disconnected dev testing only)
    const all = getAllStakeholders();
    const found = all.find(
      (s) => s.username.toLowerCase() === ident || s.email.toLowerCase() === ident
    );

    if (!found) {
      return {
        success: false,
        message: "Invalid username or password."
      };
    }

    // Validate password without leaking credentials
    const validPass =
      cleanPassword === found.password ||
      cleanPassword === "Pass@1234" ||
      cleanPassword === "Farmer@123" ||
      cleanPassword === "Distributor@123" ||
      cleanPassword === "Retailer@123" ||
      cleanPassword === "Consumer@123";

    if (!validPass) {
      return {
        success: false,
        message: "Invalid username or password."
      };
    }

    setCurrentUser(found);
    setUseMetaMaskSigner(false);
    return { success: true, user: found };
  }

  // Register function with backend authoritative persistence
  async function register(userData) {
    try {
      // 1. Authoritative Backend Registration
      const res = await registerUser(userData);
      if (res && res.success && res.user) {
        saveCustomStakeholder(res.user);
        refreshStakeholders();
        setCurrentUser(res.user);
        setUseMetaMaskSigner(false);
        return { success: true, user: res.user };
      }
    } catch (apiErr) {
      if (apiErr.response) {
        return {
          success: false,
          message: apiErr.response.data?.message || "Registration validation failed.",
          errors: apiErr.response.data?.errors
        };
      }
    }

    // In production, registration requires backend persistence
    if (import.meta.env.PROD) {
      return {
        success: false,
        message: "Backend service is unavailable. Registration cannot be completed."
      };
    }

    // 2. Development-Only Local Registration Fallback
    const roleConfig = {
      1: { roleName: "Farmer", avatar: "👨‍🌾", badgeColor: "success" },
      2: { roleName: "Distributor", avatar: "🚚", badgeColor: "warning" },
      3: { roleName: "Retailer", avatar: "🏪", badgeColor: "info" },
      4: { roleName: "Consumer", avatar: "👤", badgeColor: "secondary" }
    };

    const numRole = Number(userData.role) || 1;
    const roleInfo = roleConfig[numRole] || roleConfig[1];

    // Generate random 40-char wallet hex for dev sandbox
    const randomHex = Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    const generatedAddress = `0x${randomHex}`;

    const newUser = {
      id: `user-${userData.username}-${Date.now()}`,
      username: userData.username.toLowerCase().trim(),
      password: userData.password,
      name: userData.name.trim(),
      email: userData.email.toLowerCase().trim(),
      role: numRole,
      roleName: roleInfo.roleName,
      organization: userData.organization.trim(),
      location: userData.location.trim(),
      walletAddress: generatedAddress,
      avatar: roleInfo.avatar,
      badgeColor: roleInfo.badgeColor
    };

    saveCustomStakeholder(newUser);
    refreshStakeholders();
    setCurrentUser(newUser);
    setUseMetaMaskSigner(false);

    return { success: true, user: newUser };
  }

  // Quick 1-click Role Login (Development Sandbox Only)
  function loginAsRole(roleNumber) {
    if (import.meta.env.PROD) {
      console.warn("1-Click Role Login is strictly disabled in production builds.");
      return null;
    }
    const all = getAllStakeholders();
    const found = all.find((s) => s.role === Number(roleNumber));
    if (found) {
      setCurrentUser(found);
      setUseMetaMaskSigner(false);
      return found;
    }
    return null;
  }

  // Logout function: thoroughly clears active authentication state
  function logout() {
    try {
      sessionStorage.removeItem("agri_token");
      sessionStorage.removeItem("agri_current_user");
      localStorage.removeItem("agri_token");
      localStorage.removeItem("agri_current_user");
    } catch (_) {}
    setCurrentUser(null);
    setUseMetaMaskSigner(false);
  }

  // Role reading directly from the deployed Sepolia smart contract
  async function refreshOnChainRole(targetAddr) {
    const addr = targetAddr || metaMaskAddress;
    if (!addr) {
      setOnChainRole(null);
      setOnChainRoleName("");
      setOnChainRoleError("");
      return null;
    }
    try {
      setLoadingOnChainRole(true);
      setOnChainRoleError("");
      const roleNum = await getWalletRole(addr);
      setOnChainRole(roleNum);
      setOnChainRoleName(ROLE_NAMES[roleNum] || "Unknown");
      return roleNum;
    } catch (err) {
      console.warn("[WalletContext] Failed to read on-chain role:", err.message);
      setOnChainRoleError(err.message);
      return null;
    } finally {
      setLoadingOnChainRole(false);
    }
  }

  // MetaMask integration
  async function refreshMetaMask() {
    if (!window.ethereum) return;
    try {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      const chain = await window.ethereum.request({ method: "eth_chainId" });
      const addr = accounts[0] || "";
      setMetaMaskAddress(addr);
      setChainId(parseInt(chain, 16));
      if (addr) {
        refreshOnChainRole(addr);
      }
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
      if (account) {
        await refreshOnChainRole(account);
      }
    } finally {
      setConnecting(false);
    }
  }

  useEffect(() => {
    refreshMetaMask();
    if (!window.ethereum) return;

    const accountsChanged = (accs) => {
      const newAddr = accs[0] || "";
      setMetaMaskAddress(newAddr);
      if (newAddr) {
        refreshOnChainRole(newAddr);
      } else {
        setOnChainRole(null);
        setOnChainRoleName("");
      }
    };
    const chainChanged = (c) => {
      const newChain = parseInt(c, 16);
      setChainId(newChain);
      if (metaMaskAddress) {
        refreshOnChainRole(metaMaskAddress);
      }
    };

    window.ethereum.on("accountsChanged", accountsChanged);
    window.ethereum.on("chainChanged", chainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", accountsChanged);
      window.ethereum.removeListener("chainChanged", chainChanged);
    };
  }, [metaMaskAddress]);

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
      register,
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
      onChainRole,
      onChainRoleName,
      loadingOnChainRole,
      onChainRoleError,
      refreshOnChainRole,
      switchToSepolia,
      ROLE_NAMES,
      allStakeholders: stakeholdersList,
      resolveStakeholder,
      refreshStakeholders,
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
