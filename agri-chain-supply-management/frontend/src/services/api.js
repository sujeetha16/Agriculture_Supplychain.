// Path: frontend/src/services/api.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" }
});

export async function getProducts() {
  const { data } = await api.get("/products");
  return data.products;
}

export async function getStats() {
  const { data } = await api.get("/products/stats");
  return data.stats;
}

export async function getProduct(productId) {
  const { data } = await api.get(`/products/${productId}`);
  return data.product;
}

export async function getProductsByWallet(address) {
  const { data } = await api.get(`/products/wallet/${address}`);
  return data.products;
}

export async function createProduct(payload) {
  const { data } = await api.post("/products", payload);
  return data.product;
}

export async function postAction(path, payload) {
  const { data } = await api.post(path, payload);
  return data.product;
}

export async function resetDemoData() {
  const { data } = await api.post("/products/reset-demo");
  return data;
}

export default api;
