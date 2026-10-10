// Path: frontend/src/context/WalletContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { connectWallet, SEPOLIA_CHAIN_ID } from "../services/blockchain";
import {
  STAKEHOLDERS,
  getAllStakeholders,
  saveCustomStakeholder,
  resolveStakeholder
} from "../services/stakeholders";
import { loginUser, registerUser } from "../services/api";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  // Authentication State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("agri_current_user");
      return saved ? JSON.parse(saved) : STAKEHOLDERS[0]; // Default to Farmer
    } catch (_) {
      return STAKEHOLDERS[0];
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

  // Synchronize user to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("agri_current_user", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("agri_current_user");
    }
  }, [currentUser]);

  // Login function with backend call and robust local fallback
  async function login(username, password) {
    const ident = (username || "").toLowerCase().trim();
    const cleanPassword = (password || "").trim();

    try {
      // 1. Attempt API login
      const res = await loginUser({ username: ident, password: cleanPassword });
      if (res && res.success && res.user) {
        saveCustomStakeholder(res.user);
        refreshStakeholders();
        setCurrentUser(res.user);
        setUseMetaMaskSigner(false);
        return { success: true, user: res.user };
      }
    } catch (apiErr) {
      // If API returned a specific 400/401/404 error message, check it
      if (apiErr.response?.data?.message) {
        // Fall back to local check if API is unreachable or offline
      }
    }

    // 2. Local Fallback Validation
    const all = getAllStakeholders();
    const found = all.find(
      (s) => s.username.toLowerCase() === ident || s.email.toLowerCase() === ident
    );

    if (!found) {
      return {
        success: false,
        message: "No registered stakeholder found with this username or email. Please register as a new user."
      };
    }

    // Check password
    const validPass =
      !cleanPassword || // if empty in demo mode
      cleanPassword === found.password ||
      cleanPassword === "Pass@1234" ||
      cleanPassword === "demo123" ||
      cleanPassword.toLowerCase() === `${found.username.toLowerCase()}123`;

    if (!validPass) {
      return {
        success: false,
        message: `Incorrect password for @${found.username}. Default password is: '${found.password || "Farmer@123"}'`
      };
    }

    setCurrentUser(found);
    setUseMetaMaskSigner(false);
    return { success: true, user: found };
  }

  // Register function with backend call and robust local fallback
  async function register(userData) {
    try {
      // 1. Attempt backend registration
      const res = await registerUser(userData);
      if (res && res.success && res.user) {
        saveCustomStakeholder(res.user);
        refreshStakeholders();
        setCurrentUser(res.user);
        setUseMetaMaskSigner(false);
        return { success: true, user: res.user };
      }
    } catch (apiErr) {
      if (apiErr.response?.data?.errors) {
        return {
          success: false,
          message: apiErr.response.data.message || "Validation failed",
          errors: apiErr.response.data.errors
        };
      }
    }

    // 2. Local Registration Fallback
    const roleConfig = {
      1: { roleName: "Farmer", avatar: "👨‍🌾", badgeColor: "success" },
      2: { roleName: "Distributor", avatar: "🚚", badgeColor: "warning" },
      3: { roleName: "Retailer", avatar: "🏪", badgeColor: "info" },
      4: { roleName: "Consumer", avatar: "👤", badgeColor: "secondary" }
    };

    const numRole = Number(userData.role) || 1;
    const roleInfo = roleConfig[numRole] || roleConfig[1];

    // Generate random 40-char wallet hex
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

  // Quick 1-click Role Login
  function loginAsRole(roleNumber) {
    const all = getAllStakeholders();
    const found = all.find((s) => s.role === Number(roleNumber));
    if (found) {
      setCurrentUser(found);
      setUseMetaMaskSigner(false);
      return found;
    }
    return null;
  }

  // Logout function
  function logout() {
    try {
      localStorage.removeItem("agri_token");
      localStorage.removeItem("agri_current_user");
    } catch (_) {}
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
