// Path: frontend/src/services/api.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" }
});

// Automatically inject JWT authentication header
api.interceptors.request.use((config) => {
  try {
    const token = sessionStorage.getItem("agri_token") || localStorage.getItem("agri_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (_) {}
  return config;
});

export async function loginUser(credentials) {
  const { data } = await api.post("/auth/login", credentials);
  if (data && data.token) {
    sessionStorage.setItem("agri_token", data.token);
    localStorage.setItem("agri_token", data.token);
  }
  return data;
}

export async function registerUser(userData) {
  const { data } = await api.post("/auth/register", userData);
  if (data && data.token) {
    sessionStorage.setItem("agri_token", data.token);
    localStorage.setItem("agri_token", data.token);
  }
  return data;
}

export function logoutUser() {
  sessionStorage.removeItem("agri_token");
  sessionStorage.removeItem("agri_current_user");
  localStorage.removeItem("agri_token");
  localStorage.removeItem("agri_current_user");
}

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

export async function verifyProductProof(productId) {
  const { data } = await api.get(`/products/${productId}/verify`);
  return data;
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
