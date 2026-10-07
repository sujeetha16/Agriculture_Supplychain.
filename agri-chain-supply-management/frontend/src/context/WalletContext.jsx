// Path: frontend/src/context/WalletContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { connectWallet, SEPOLIA_CHAIN_ID } from "../services/blockchain";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);

  async function refresh() {
    if (!window.ethereum) return;
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    const chain = await window.ethereum.request({ method: "eth_chainId" });
    setAddress(accounts[0] || "");
    setChainId(parseInt(chain, 16));
  }

  async function connect() {
    try {
      setConnecting(true);
      const account = await connectWallet();
      setAddress(account);
      const chain = await window.ethereum.request({ method: "eth_chainId" });
      setChainId(parseInt(chain, 16));
    } finally {
      setConnecting(false);
    }
  }

  useEffect(() => {
    refresh();
    if (!window.ethereum) return;

    const accountsChanged = () => refresh();
    const chainChanged = () => refresh();

    window.ethereum.on("accountsChanged", accountsChanged);
    window.ethereum.on("chainChanged", chainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", accountsChanged);
      window.ethereum.removeListener("chainChanged", chainChanged);
    };
  }, []);

  return (
    <WalletContext.Provider value={{
      address,
      chainId,
      isSepolia: chainId === SEPOLIA_CHAIN_ID,
      connecting,
      connect
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
