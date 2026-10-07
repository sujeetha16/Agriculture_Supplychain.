// Path: frontend/src/pages/ProductActions.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Alert from "../components/Alert";
import TransactionFeedback from "../components/TransactionFeedback";
import ProductTimeline from "../components/ProductTimeline";
import ProductQRCode from "../components/QRCode";
import { getProduct, postAction } from "../services/api";
import { useWallet } from "../context/WalletContext";
import {
  getSignerAndContract,
  dispatchToDistributor,
  receiveFromFarmer,
  dispatchToRetailer,
  receiveFromDistributor,
  sellToConsumer
} from "../services/blockchain";

const initial = {
  date: new Date().toISOString().slice(0, 10),
  receiverAddress: ""
};

const roleNames = {
  1: "Farmer",
  2: "Distributor",
  3: "Retailer",
  4: "Consumer"
};

export default function ProductActions() {
  const { productId } = useParams();
  const { address } = useWallet();
  const [product, setProduct] = useState(null);
  const [role, setRole] = useState(0);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await getProduct(productId);
      setProduct(data);

      if (address) {
        const { contract } = await getSignerAndContract();
        setRole(Number(await contract.getRole(address)));
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }

  useEffect(() => { load(); }, [productId, address]);

  async function perform(blockchainCall, apiPath, receiverAddress = null) {
    setError("");
    setHash("");

    try {
      if (!address) throw new Error("Connect the correct MetaMask wallet first.");
      setBusy(true);

      const result = await blockchainCall();
      setHash(result.hash);

      await postAction(apiPath, {
        actorAddress: address,
        receiverAddress,
        date: form.date,
        txHash: result.hash
      });

      await load();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!product) {
    return <div className="container py-5"><div className="spinner-border text-success"></div></div>;
  }

  const status = product.status;

  const actionAllowed =
    (status === "Created" && role === 1 && product.farmer.toLowerCase() === address?.toLowerCase()) ||
    (status === "DispatchedToDistributor" && role === 2 && product.distributor?.toLowerCase() === address?.toLowerCase()) ||
    (status === "ReceivedByDistributor" && role === 2 && product.distributor?.toLowerCase() === address?.toLowerCase()) ||
    (status === "DispatchedToRetailer" && role === 3 && product.retailer?.toLowerCase() === address?.toLowerCase()) ||
    (status === "ReceivedByRetailer" && role === 3 && product.retailer?.toLowerCase() === address?.toLowerCase());

  return (
    <div className="container py-5">
      <div className="d-flex flex-wrap justify-content-between align-items-start mb-4 gap-3">
        <div>
          <span className="badge text-bg-success">Product #{product.productId}</span>
          <h2 className="fw-bold mt-2">{product.name}</h2>
          <p className="text-secondary mb-0">Harvest date: {product.harvestDate}</p>
        </div>
        <div className="qr-box">
          <ProductQRCode product={product} />
        </div>
      </div>

      <Alert message={error} />
      <TransactionFeedback hash={hash} />

      <div className="row g-4">
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <h5 className="fw-bold mb-4">Full Product Journey</h5>
              <ProductTimeline product={product} />
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <h5 className="fw-bold">Next Action</h5>
              <p className="text-secondary small">
                Connected wallet: {address || "Not connected"}<br />
                Role: {roleNames[role] || "Not registered"}
              </p>

              {!actionAllowed && (
                <div className="alert alert-secondary">
                  This product has no action available for the current wallet.
                  Use the Trace page to view its journey.
                </div>
              )}

              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-control mb-3"
                value={form.date}
                disabled={!actionAllowed || busy}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />

              {actionAllowed && status === "Created" && role === 1 && (
                <>
                  <label className="form-label">Distributor wallet</label>
                  <input
                    className="form-control"
                    placeholder="0x..."
                    value={form.receiverAddress}
                    onChange={(e) => setForm({ ...form, receiverAddress: e.target.value })}
                  />
                  <button
                    className="btn btn-success w-100 mt-3"
                    disabled={busy}
                    onClick={() => perform(
                      () => dispatchToDistributor(product.productId, form.receiverAddress, form.date),
                      `/products/${product.productId}/dispatch-distributor`,
                      form.receiverAddress
                    )}
                  >
                    Dispatch to Distributor
                  </button>
                </>
              )}

              {actionAllowed && status === "DispatchedToDistributor" && role === 2 && (
                <button
                  className="btn btn-success w-100"
                  disabled={busy}
                  onClick={() => perform(
                    () => receiveFromFarmer(product.productId, form.date),
                    `/products/${product.productId}/receive-distributor`
                  )}
                >
                  Receive from Farmer
                </button>
              )}

              {actionAllowed && status === "ReceivedByDistributor" && role === 2 && (
                <>
                  <label className="form-label">Retailer wallet</label>
                  <input
                    className="form-control"
                    placeholder="0x..."
                    value={form.receiverAddress}
                    onChange={(e) => setForm({ ...form, receiverAddress: e.target.value })}
                  />
                  <button
                    className="btn btn-success w-100 mt-3"
                    disabled={busy}
                    onClick={() => perform(
                      () => dispatchToRetailer(product.productId, form.receiverAddress, form.date),
                      `/products/${product.productId}/dispatch-retailer`,
                      form.receiverAddress
                    )}
                  >
                    Dispatch to Retailer
                  </button>
                </>
              )}

              {actionAllowed && status === "DispatchedToRetailer" && role === 3 && (
                <button
                  className="btn btn-success w-100"
                  disabled={busy}
                  onClick={() => perform(
                    () => receiveFromDistributor(product.productId, form.date),
                    `/products/${product.productId}/receive-retailer`
                  )}
                >
                  Receive from Distributor
                </button>
              )}

              {actionAllowed && status === "ReceivedByRetailer" && role === 3 && (
                <>
                  <label className="form-label">Consumer wallet</label>
                  <input
                    className="form-control"
                    placeholder="0x..."
                    value={form.receiverAddress}
                    onChange={(e) => setForm({ ...form, receiverAddress: e.target.value })}
                  />
                  <button
                    className="btn btn-success w-100 mt-3"
                    disabled={busy}
                    onClick={() => perform(
                      () => sellToConsumer(product.productId, form.receiverAddress, form.date),
                      `/products/${product.productId}/sell-consumer`,
                      form.receiverAddress
                    )}
                  >
                    Sell to Consumer
                  </button>
                </>
              )}

              {status === "SoldToConsumer" && (
                <div className="alert alert-success mb-0">
                  This product journey is complete.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
