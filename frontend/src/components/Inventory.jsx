import { useEffect, useState } from "react";

function Inventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);

  useEffect(() => {
    fetchProducts();
    fetch("http://localhost:5000/api/settings")
      .then((r) => r.json())
      .then((data) => setLowStockThreshold(Number(data.lowStockThreshold || 10)))
      .catch(() => setLowStockThreshold(10));
  }, []);

  async function fetchProducts() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("http://localhost:5000/api/inventory");
      if (!resp.ok) throw new Error("Failed to load inventory");
      const data = await resp.json();
      setProducts(data);
    } catch (err) {
      setError(err.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  const filtered = products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  const totalProducts = products.length;
  const totalUnits = products.reduce((s, p) => s + Number(p.stock), 0);
  const lowStockCount = products.filter((p) => Number(p.stock) >= 0 && Number(p.stock) <= lowStockThreshold).length;

  function statusLabel(stock) {
    const s = Number(stock);
    if (s === 0) return { text: "Out of Stock", className: "status out" };
    if (s > 0 && s <= lowStockThreshold) return { text: "Low Stock", className: "status low" };
    return { text: "In Stock", className: "status ok" };
  }

  function openUpdate(p) {
    setSelected({ ...p, newStock: p.stock });
  }

  function closeUpdate() {
    setSelected(null);
  }

  async function submitUpdate() {
    if (!selected) return;
    const newStockNum = Number(selected.newStock);
    if (!Number.isFinite(newStockNum) || newStockNum < 0) {
      alert("Stock must be a non-negative number");
      return;
    }

    setUpdating(true);
    try {
      const resp = await fetch(`http://localhost:5000/api/inventory/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: newStockNum })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update stock");
      }

      const updated = await resp.json();
      // update products in state
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setSelected(null);
      alert("Stock updated");
    } catch (err) {
      alert("Error: " + (err.message || "Failed to update stock"));
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="inventory-page">
      <h2>Inventory</h2>

      <div className="inventory-summary">
        <div className="stat-card">
          <h3>Total Products</h3>
          <p>{totalProducts}</p>
        </div>

        <div className="stat-card">
          <h3>Total Stock Units</h3>
          <p>{totalUnits}</p>
        </div>

        <div className="stat-card">
          <h3>Low Stock Products</h3>
          <p>{lowStockCount}</p>
        </div>
      </div>

      <div style={{ marginTop: 16, marginBottom: 12 }}>
        <input placeholder="Search products..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {loading ? (
        <p>Loading inventory...</p>
      ) : error ? (
        <p style={{ color: "red" }}>{error}</p>
      ) : filtered.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <table className="sales-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const st = statusLabel(p.stock);
              return (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>Rs. {Number(p.price).toFixed(2)}</td>
                  <td style={{ textAlign: "center" }}>{p.stock}</td>
                  <td><span className={st.className}>{st.text}</span></td>
                  <td><button onClick={() => openUpdate(p)}>Update Stock</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {selected && (
        <div className="modal-overlay">
          <div className="checkout-modal">
            <h3>Update Stock</h3>
            <div style={{ marginBottom: 8 }}>
              <div><strong>{selected.name}</strong></div>
              <div>Current stock: {selected.stock}</div>
            </div>

            <div style={{ marginTop: 8 }}>
              <input type="number" value={selected.newStock} onChange={(e) => setSelected({ ...selected, newStock: e.target.value })} />
            </div>

            <div className="modal-actions" style={{ marginTop: 12 }}>
              <button className="btn btn-secondary" onClick={closeUpdate} disabled={updating}>Cancel</button>
              <button className="btn btn-primary" onClick={submitUpdate} disabled={updating}>{updating ? "Updating..." : "Update Stock"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Inventory;
