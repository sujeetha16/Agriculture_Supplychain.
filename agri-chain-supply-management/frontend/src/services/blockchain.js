// Path: frontend/src/services/blockchain.js
import { ethers } from "ethers";
import contractJson from "../contracts/AgriChain.json";

export const SEPOLIA_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 11155111);
export const SEPOLIA_HEX = "0xaa36a7";

export const DEMO_PERSONAS = {
  1: {
    role: 1,
    roleName: "Farmer",
    name: "Green Valley Organics",
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    location: "Yakima Valley, Washington",
    icon: "bi-person-badge"
  },
  2: {
    role: 2,
    roleName: "Distributor",
    name: "Pacific Cold-Chain Logistics",
    address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    location: "Pacific NW Logistics Hub, Seattle",
    icon: "bi-truck"
  },
  3: {
    role: 3,
    roleName: "Retailer",
    name: "FreshMarket Organics",
    address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4df",
    location: "Store #104, Westlake Avenue",
    icon: "bi-shop"
  },
  4: {
    role: 4,
    roleName: "Consumer",
    name: "Retail Consumer",
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    location: "Seattle, WA",
    icon: "bi-person-check"
  }
};

export function generateSimulatedTxHash() {
  const chars = "0123456789abcdef";
  let hash = "0x";
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

export function contractAddress() {
  const envAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
  const jsonAddress = contractJson.address;
  const address = envAddress && envAddress !== "PASTE_DEPLOYED_CONTRACT_ADDRESS"
    ? envAddress
    : jsonAddress;

  if (!address || address === "PASTE_DEPLOYED_CONTRACT_ADDRESS") {
    throw new Error("Contract address is not configured. Please check frontend/src/contracts/AgriChain.json.");
  }
  return address;
}

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed. You can still use the Demo Simulation Role switcher!");
  }

  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  await switchToSepolia();

  return accounts[0];
}

export async function switchToSepolia() {
  if (!window.ethereum) throw new Error("MetaMask is not installed.");

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_HEX }]
    });
  } catch (error) {
    if (error.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: SEPOLIA_HEX,
          chainName: "Sepolia",
          nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [import.meta.env.VITE_SEPOLIA_RPC_URL || "https://rpc.sepolia.org"],
          blockExplorerUrls: ["https://sepolia.etherscan.io"]
        }]
      });
    } else {
      throw error;
    }
  }
}

export async function getSignerAndContract() {
  if (!window.ethereum) throw new Error("MetaMask is not installed. Please switch to Demo Mode or install MetaMask.");
  await switchToSepolia();

  const provider = new ethers.BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
    throw new Error("Please switch MetaMask network to Sepolia.");
  }

  const signer = await provider.getSigner();
  const contract = new ethers.Contract(contractAddress(), contractJson.abi, signer);
  return { signer, contract };
}

export const ROLE_NAMES = {
  0: "Unregistered",
  1: "Farmer",
  2: "Distributor",
  3: "Retailer",
  4: "Consumer"
};

export async function getReadOnlyContract() {
  const address = contractAddress();
  if (window.ethereum) {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      if (Number(network.chainId) === SEPOLIA_CHAIN_ID) {
        return new ethers.Contract(address, contractJson.abi, provider);
      }
    } catch (_) {}
  }

  const rpcCandidates = [
    import.meta.env.VITE_SEPOLIA_RPC_URL,
    "https://ethereum-sepolia-rpc.publicnode.com",
    "https://rpc.sepolia.org",
    "https://1rpc.io/sepolia"
  ].filter(Boolean);

  for (const rpc of rpcCandidates) {
    try {
      const rpcProvider = new ethers.JsonRpcProvider(rpc);
      return new ethers.Contract(address, contractJson.abi, rpcProvider);
    } catch (_) {}
  }

  throw new Error("Unable to establish connection to Sepolia RPC.");
}

export async function getWalletRole(walletAddress) {
  if (!walletAddress) return 0;
  try {
    const contract = await getReadOnlyContract();
    const role = await contract.getRole(walletAddress);
    return Number(role);
  } catch (error) {
    console.warn(`[getWalletRole] Error querying role for ${walletAddress}:`, error.message);
    throw normalizeBlockchainError(error);
  }
}

export async function registerRole(roleNumber) {
  try {
    const num = Number(roleNumber);
    if (![1, 2, 3, 4].includes(num)) {
      throw new Error("Invalid role selected. Must be Farmer (1), Distributor (2), Retailer (3), or Consumer (4).");
    }

    const { signer, contract } = await getSignerAndContract();
    const signerAddress = await signer.getAddress();

    // Verify current role before sending transaction to prevent unnecessary reverts and gas loss
    const currentRole = await contract.getRole(signerAddress);
    const roleNum = Number(currentRole);
    if (roleNum !== 0) {
      const existingRole = ROLE_NAMES[roleNum] || `Role ${roleNum}`;
      throw new Error(`Wallet ${signerAddress} is already registered on-chain as ${existingRole}. The AgriChain contract permanently enforces one role per address.`);
    }

    // Supply a safely buffered gas limit to prevent out-of-gas reverts,
    // especially for EIP-7702 delegated accounts (MetaMask smart accounts).
    let gasLimit = 600000n;
    try {
      const estimated = await contract.registerRole.estimateGas(num);
      const buffered = (estimated * 150n) / 100n;
      gasLimit = buffered > 500000n ? buffered : 500000n;
    } catch (_) {
      gasLimit = 600000n;
    }

    const tx = await contract.registerRole(num, { gasLimit });
    const receipt = await tx.wait();

    if (!receipt || receipt.status === 0) {
      throw new Error("Role registration transaction was reverted on the blockchain.");
    }

    return {
      hash: receipt.hash || tx.hash,
      receipt,
      role: num,
      roleName: ROLE_NAMES[num],
      address: signerAddress
    };
  } catch (error) {
    throw normalizeBlockchainError(error);
  }
}

export async function createProductOnChain(name, harvestDate) {
  try {
    const { signer, contract } = await getSignerAndContract();
    const signerAddress = await signer.getAddress();

    // Read signer's actual role directly from the smart contract before submitting
    const currentRole = await contract.getRole(signerAddress);
    const roleNum = Number(currentRole);

    if (roleNum !== 1) {
      if (roleNum === 0) {
        throw new Error(
          `Connected wallet (${signerAddress}) is not registered on the smart contract. Please register the Farmer role (Role 1) on the Register Role page before creating agricultural products.`
        );
      } else {
        const actualRoleName = ROLE_NAMES[roleNum] || `Role ${roleNum}`;
        throw new Error(
          `Connected wallet (${signerAddress}) has on-chain role "${actualRoleName}". The smart contract requires the Farmer role (Role 1) to execute createProduct(). Please switch to a registered Farmer wallet.`
        );
      }
    }

    // createProduct writes a 14-field struct into multiple storage slots (~616k base gas).
    // Supply a safely buffered gas limit (min 850,000 gas) for EIP-7702 delegation overhead.
    let gasLimit = 900000n;
    try {
      const estimated = await contract.createProduct.estimateGas(name, harvestDate);
      const buffered = (estimated * 140n) / 100n;
      gasLimit = buffered > 850000n ? buffered : 850000n;
    } catch (_) {
      gasLimit = 900000n;
    }

    const tx = await contract.createProduct(name, harvestDate, { gasLimit });
    const receipt = await tx.wait();

    if (!receipt || receipt.status === 0) {
      throw new Error("Product creation transaction was reverted on the blockchain.");
    }

    let productId = null;
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed && parsed.name === "ProductCreated") {
          productId = Number(parsed.args.productId);
          break;
        }
      } catch (_) {}
    }

    if (!productId) {
      throw new Error("Transaction confirmed on Sepolia, but the ProductCreated event was not emitted by the smart contract.");
    }

    return {
      hash: receipt.hash || tx.hash,
      receipt,
      productId,
      signerAddress
    };
  } catch (error) {
    throw normalizeBlockchainError(error);
  }
}

export async function dispatchToDistributor(productId, distributor, date) {
  try {
    const { contract } = await getSignerAndContract();
    const tx = await contract.dispatchToDistributor(productId, distributor, date);
    const receipt = await tx.wait();
    return { hash: receipt.hash || tx.hash, receipt };
  } catch (error) {
    throw normalizeBlockchainError(error);
  }
}

export async function receiveFromFarmer(productId, date) {
  try {
    const { contract } = await getSignerAndContract();
    const tx = await contract.receiveFromFarmer(productId, date);
    const receipt = await tx.wait();
    return { hash: receipt.hash || tx.hash, receipt };
  } catch (error) {
    throw normalizeBlockchainError(error);
  }
}

export async function dispatchToRetailer(productId, retailer, date) {
  try {
    const { contract } = await getSignerAndContract();
    const tx = await contract.dispatchToRetailer(productId, retailer, date);
    const receipt = await tx.wait();
    return { hash: receipt.hash || tx.hash, receipt };
  } catch (error) {
    throw normalizeBlockchainError(error);
  }
}

export async function receiveFromDistributor(productId, date) {
  try {
    const { contract } = await getSignerAndContract();
    const tx = await contract.receiveFromDistributor(productId, date);
    const receipt = await tx.wait();
    return { hash: receipt.hash || tx.hash, receipt };
  } catch (error) {
    throw normalizeBlockchainError(error);
  }
}

export async function sellToConsumer(productId, consumer, date) {
  try {
    const { contract } = await getSignerAndContract();
    const tx = await contract.sellToConsumer(productId, consumer, date);
    const receipt = await tx.wait();
    return { hash: receipt.hash || tx.hash, receipt };
  } catch (error) {
    throw normalizeBlockchainError(error);
  }
}

export async function getOnChainProduct(productId) {
  try {
    const contract = await getReadOnlyContract();
    const p = await contract.getProduct(productId);

    return {
      id: Number(p.id),
      name: p.name,
      harvestDate: p.harvestDate,
      farmer: p.farmer,
      distributor: p.distributor,
      retailer: p.retailer,
      consumer: p.consumer,
      dispatchToDistributorDate: p.dispatchToDistributorDate,
      distributorReceiveDate: p.distributorReceiveDate,
      dispatchToRetailerDate: p.dispatchToRetailerDate,
      retailerReceiveDate: p.retailerReceiveDate,
      soldToConsumerDate: p.soldToConsumerDate,
      status: Number(p.status)
    };
  } catch (error) {
    console.warn("[On-Chain Trace Warning]", error.message);
    return null;
  }
}

export function normalizeBlockchainError(error) {
  if (error?.code === 4001 || error?.code === "ACTION_REJECTED") {
    return new Error("Transaction rejected in MetaMask.");
  }

  const rawMessage = error?.data?.message || error?.error?.message || error?.reason || error?.shortMessage || error?.message || "";
  
  if (rawMessage.includes("Caller does not have required role")) {
    return new Error('Smart contract execution reverted: "Caller does not have required role". Connected wallet must be registered as a Farmer on the AgriChain Sepolia smart contract.');
  }

  if (rawMessage.includes("Role already registered")) {
    return new Error('Smart contract execution reverted: "Role already registered". This wallet is already permanently registered on-chain.');
  }

  if (rawMessage.includes("Invalid role")) {
    return new Error('Smart contract execution reverted: "Invalid role". Must be Farmer (1), Distributor (2), Retailer (3), or Consumer (4).');
  }

  if (error?.shortMessage) {
    return new Error(error.shortMessage);
  }
  if (error?.reason) {
    return new Error(error.reason);
  }
  return new Error(rawMessage || "Blockchain transaction failed.");
}
