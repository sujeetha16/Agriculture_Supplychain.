// Path: frontend/src/services/blockchain.js
import { ethers } from "ethers";
import contractJson from "../contracts/AgriChain.json";

export const SEPOLIA_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 11155111);
export const SEPOLIA_HEX = "0xaa36a7";

function contractAddress() {
  const envAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
  const jsonAddress = contractJson.address;
  const address = envAddress && envAddress !== "PASTE_DEPLOYED_CONTRACT_ADDRESS"
    ? envAddress
    : jsonAddress;

  if (!address || address === "PASTE_DEPLOYED_CONTRACT_ADDRESS") {
    throw new Error("Contract address is not configured. Deploy the contract and update frontend/.env.");
  }
  return address;
}

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed. Install MetaMask and refresh the page.");
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
  if (!window.ethereum) throw new Error("MetaMask is not installed.");
  await switchToSepolia();

  const provider = new ethers.BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
    throw new Error("Please switch MetaMask to Sepolia.");
  }

  const signer = await provider.getSigner();
  const contract = new ethers.Contract(contractAddress(), contractJson.abi, signer);
  return { signer, contract };
}

export async function registerRole(roleNumber) {
  try {
    const { contract } = await getSignerAndContract();
    const tx = await contract.registerRole(roleNumber);
    const receipt = await tx.wait();
    return { hash: receipt.hash || tx.hash, receipt };
  } catch (error) {
    throw normalizeBlockchainError(error);
  }
}

export async function createProductOnChain(name, harvestDate) {
  try {
    const { contract } = await getSignerAndContract();
    const tx = await contract.createProduct(name, harvestDate);
    const receipt = await tx.wait();

    let productId;
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
      throw new Error("Transaction succeeded, but ProductCreated event could not be decoded.");
    }

    return { hash: receipt.hash || tx.hash, receipt, productId };
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
    if (!window.ethereum) throw new Error("MetaMask is not installed.");
    await switchToSepolia();

    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(contractAddress(), contractJson.abi, provider);
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
    throw normalizeBlockchainError(error);
  }
}

function normalizeBlockchainError(error) {
  if (error?.code === 4001) {
    return new Error("Transaction rejected in MetaMask.");
  }
  if (error?.code === "ACTION_REJECTED") {
    return new Error("Transaction rejected in MetaMask.");
  }
  if (error?.shortMessage) {
    return new Error(error.shortMessage);
  }
  if (error?.reason) {
    return new Error(error.reason);
  }
  return new Error(error?.message || "Blockchain transaction failed.");
}
