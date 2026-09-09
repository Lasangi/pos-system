import { useEffect, useState } from "react";
import Receipt from "./Receipt";

function Sales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [printSale, setPrintSale] = useState(null);
  const [detailLoading, setDetailLoading] = useState(null);

  useEffect(() => {
    fetchSales();
  }, []);

  async function fetchSales() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("http://localhost:5000/api/sales");
      if (!resp.ok) throw new Error("Failed to load sales");
      const data = await resp.json();
      setSales(data);
    } catch (err) {
      setError(err.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  async function viewSale(id) {
    setDetailLoading(id);
    try {
      const resp = await fetch(`http://localhost:5000/api/sales/${id}`);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load sale");
      }
      const data = await resp.json();
      setSelected(data);
    } catch (err) {
      alert("Error: " + (err.message || "Failed to load sale"));
    } finally {
      setDetailLoading(null);
    }
  }

  const viewDetails = viewSale;

  return (
    <div className="sales-page">
      <h2>Sales</h2>

      {loading ? (
        <p>Loading sales...</p>
      ) : error ? (
        <p style={{ color: "red" }}>{error}</p>
      ) : sales.length === 0 ? (
        <p>No sales found.</p>
      ) : (
        <table className="sales-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.customer_name || 'Walk-in Customer'}</td>
                  <td>Rs. {Number(s.total).toFixed(2)}</td>
                  <td>{s.payment_method}</td>
                  <td>{new Date(s.created_at).toLocaleString()}</td>
                  <td>
                    <button onClick={() => viewDetails(s.id)} disabled={detailLoading === s.id}>
                      {detailLoading === s.id ? 'Loading...' : 'View Details'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      {selected && (
        <div className="modal-overlay">
          <div className="checkout-modal">
            <h3>Sale #{selected.sale.id}</h3>
            <div style={{ marginBottom: 8 }}>
              <div>Date: {new Date(selected.sale.created_at).toLocaleString()}</div>
               <div>Payment: {selected.sale.payment_method}</div>
               <div>Customer: {selected.sale.customer_name || 'Walk-in Customer'}</div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Product</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((it) => (
                  <tr key={it.product_id}>
                    <td>{it.name}</td>
                    <td style={{ textAlign: "center" }}>{it.quantity}</td>
                    <td style={{ textAlign: "right" }}>Rs. {Number(it.price).toFixed(2)}</td>
                    <td style={{ textAlign: "right" }}>Rs. {Number(it.subtotal).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 12, textAlign: "right" }}>
              <strong>Total: Rs. {Number(selected.sale.total).toFixed(2)}</strong>
            </div>

            <div className="modal-actions" style={{ marginTop: 12 }}>
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => {
                const combined = { ...selected.sale, items: selected.items };
                setPrintSale(combined);
                setTimeout(() => { window.print(); setPrintSale(null); }, 200);
              }} style={{ marginLeft: 8 }}>Print Receipt</button>
            </div>
            {printSale && <div style={{ display: 'none' }}><Receipt sale={printSale} /></div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default Sales;
