import { useEffect, useState } from "react";
import Receipt from "./components/Receipt";

const DEFAULT_SETTINGS = {
  currency: "LKR",
  taxEnabled: false,
  taxRate: 0,
  defaultPaymentMethod: "Cash",
  lowStockThreshold: 10,
};

function formatCurrency(value, currency = "LKR") {
  const amount = Number(value || 0);
  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${currency} ${formatter.format(amount)}`;
}

function POS({ user }) {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    fetch("http://localhost:5000/api/products")
      .then((response) => response.json())
      .then((data) => setProducts(data));

    fetch("http://localhost:5000/api/customers")
      .then((r) => r.json())
      .then((data) => setCustomers(data))
      .catch(() => setCustomers([]));

    fetch("http://localhost:5000/api/settings")
      .then((response) => response.json())
      .then((data) => {
        setSettings({ ...DEFAULT_SETTINGS, ...data });
      })
      .catch(() => setSettings(DEFAULT_SETTINGS));
  }, []);

  function addToCart(product) {
    const existingProduct = cart.find((item) => item.id === product.id);

    if (existingProduct) {
      setCart(
        cart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  }

  function increaseQuantity(id) {
    setCart(
      cart.map((item) =>
        item.id === id ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  }

  function decreaseQuantity(id) {
    setCart(
      cart
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeItem(id) {
    setCart((currentCart) => currentCart.filter((item) => item.id !== id));
  }

  const subtotal = cart.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  );

  const [showModal, setShowModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [processing, setProcessing] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [discount, setDiscount] = useState("");
  const [taxRate, setTaxRate] = useState(Number(settings.taxRate || 0));
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptSale, setReceiptSale] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState(null);

  useEffect(() => {
    setPaymentMethod(String(settings.defaultPaymentMethod || "Cash").toLowerCase());
    setTaxRate(Number(settings.taxRate || 0));
  }, [settings.defaultPaymentMethod, settings.taxRate]);

  const disc = Number(discount) || 0;
  const tr = settings.taxEnabled ? Number(settings.taxRate || 0) : 0;
  const taxable = +(subtotal - disc);
  const taxAmount = settings.taxEnabled ? +(taxable * (tr / 100)) : 0;
  const finalTotal = +(taxable + taxAmount);
  const cashNum = Number(cashReceived);
  const cashIsNumber = Number.isFinite(cashNum);
  const changeAmount = cashIsNumber ? +(cashNum - finalTotal) : NaN;
  const cashSufficient = paymentMethod === "card" ? true : cashIsNumber && cashNum >= finalTotal;

  function openCheckout() {
    if (cart.length === 0) {
      alert("Cart is empty.");
      return;
    }

    setPaymentMethod(String(settings.defaultPaymentMethod || "Cash").toLowerCase());
    setDiscount("");
    setTaxRate(Number(settings.taxRate || 0));
    setCashReceived("");
    setShowModal(true);
  }

  async function completeSale() {
    if (processing) return;

    const discValue = Number(discount) || 0;
    const taxValue = settings.taxEnabled ? Number(settings.taxRate || 0) : 0;

    if (!Number.isFinite(discValue) || discValue < 0) return alert("Invalid discount");
    if (discValue > subtotal) return alert("Discount cannot exceed subtotal");
    if (!Number.isFinite(taxValue) || taxValue < 0) return alert("Invalid tax rate");

    const taxableTotal = +(subtotal - discValue);
    const taxTotal = settings.taxEnabled ? +(taxableTotal * (taxValue / 100)) : 0;
    const totalDue = +(taxableTotal + taxTotal);

    if (paymentMethod === "cash") {
      const cr = Number(cashReceived);
      if (!Number.isFinite(cr) || cr < 0) {
        return alert("Enter a valid cash received amount.");
      }
      if (cr < totalDue) {
        return alert("Cash received is less than the total.");
      }
    }

    setProcessing(true);

    const payload = {
      cart: cart.map((item) => ({ id: item.id, quantity: item.quantity })),
      payment_method: paymentMethod === "cash" ? "Cash" : "Card",
      customer_id: selectedCustomerId || null,
      discount: discValue,
      tax_rate: settings.taxEnabled ? taxValue : 0,
      user_id: user?.id || null,
    };

    try {
      const resp = await fetch("http://localhost:5000/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        alert("Checkout failed: " + (err.error || resp.statusText));
        setProcessing(false);
        return;
      }

      const data = await resp.json();
      setCart([]);
      setSelectedCustomerId(null);
      setShowModal(false);
      setProcessing(false);

      if (data && data.sale && data.items) {
        const combined = { ...data.sale, items: data.items };
        if (paymentMethod === "cash") {
          const cr = Number(cashReceived);
          combined.cashReceived = cr;
          combined.change = Number((cr - (data.sale.total || 0)).toFixed(2));
        }
        setReceiptSale(combined);
        setShowReceipt(true);
      } else {
        const saleId = data.saleId;
        setReceiptLoading(true);
        setReceiptError(null);
        try {
          const r = await fetch(`http://localhost:5000/api/sales/${saleId}`);
          if (!r.ok) throw new Error("Failed to load receipt");
          const saleData = await r.json();
          const combined = { ...saleData.sale, items: saleData.items };
          if (paymentMethod === "cash") {
            const cr = Number(cashReceived);
            combined.cashReceived = cr;
            combined.change = Number((cr - (saleData.sale.total || 0)).toFixed(2));
          }
          setReceiptSale(combined);
          setShowReceipt(true);
        } catch (e) {
          setReceiptError(e.message || "Failed to load receipt");
          alert("Sale completed but failed to load receipt: " + (e.message || ""));
        } finally {
          setReceiptLoading(false);
        }
      }
    } catch (error) {
      setProcessing(false);
      alert("Checkout failed: " + error.message);
    }
  }

  return (
    <div className="pos-page">
      <h2>Point of Sale</h2>

      <div className="pos-container">
        <div className="pos-products">
          <h3>Products</h3>

          <div className="product-grid">
            {products.map((product) => (
              <div
                className="pos-product-card"
                key={product.id}
                onClick={() => addToCart(product)}
              >
                <h4>{product.name}</h4>
                <p>{formatCurrency(product.price, settings.currency)}</p>
                <small>Stock: {product.stock}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="cart">
          <h3>Cart</h3>

          {cart.length === 0 ? (
            <div className="empty-state compact-state">
              <p>Your cart is empty.</p>
            </div>
          ) : (
            cart.map((item) => (
              <div className="cart-item" key={item.id}>
                <div className="cart-item-main">
                  <strong>{item.name}</strong>
                  <p>
                    {formatCurrency(item.price, settings.currency)} × {item.quantity}
                  </p>
                </div>

                <div className="cart-item-actions">
                  <div className="quantity-controls">
                    <button type="button" onClick={() => decreaseQuantity(item.id)} aria-label={`Decrease quantity for ${item.name}`}>
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => increaseQuantity(item.id)} aria-label={`Increase quantity for ${item.name}`}>
                      +
                    </button>
                  </div>
                  <button type="button" className="remove-item-btn" onClick={() => removeItem(item.id)}>
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}

          <div className="cart-divider" />

          <div className="cart-total">
            <strong>Total:</strong>
            <strong>{formatCurrency(subtotal, settings.currency)}</strong>
          </div>

          <button className="checkout-button" onClick={openCheckout}>
            Checkout
          </button>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="checkout-modal">
            <h3>Checkout</h3>

            <div className="checkout-sections">
              <div className="checkout-card">
                <div className="checkout-label">Customer</div>
                <select
                  value={selectedCustomerId ?? ""}
                  onChange={(e) =>
                    setSelectedCustomerId(e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="">Walk-in Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="checkout-card">
                <div className="checkout-label">Payment Method</div>
                <div className="payment-buttons" style={{ marginTop: 6 }}>
                  <button
                    type="button"
                    className={`payment-btn ${paymentMethod === "cash" ? "active" : ""}`}
                    onClick={() => setPaymentMethod("cash")}
                  >
                    CASH
                  </button>
                  <button
                    type="button"
                    className={`payment-btn ${paymentMethod === "card" ? "active" : ""}`}
                    onClick={() => setPaymentMethod("card")}
                  >
                    CARD
                  </button>
                </div>
              </div>

              <div className="checkout-card">
                <div className="checkout-label">Discount & Tax</div>
                <label className="checkout-field">
                  <span>Discount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </label>
                <label className="checkout-field">
                  <span>Tax Rate (%)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    disabled={!settings.taxEnabled}
                  />
                </label>
              </div>

              <div className="checkout-card">
                <div className="checkout-label">Order Summary</div>
                <div className="summary-row">
                  <span>Subtotal</span>
                  <strong>{formatCurrency(subtotal, settings.currency)}</strong>
                </div>
                <div className="summary-row">
                  <span>Discount</span>
                  <strong>-{formatCurrency(disc, settings.currency)}</strong>
                </div>
                <div className="summary-row">
                  <span>Tax ({tr.toFixed(2)}%)</span>
                  <strong>{formatCurrency(taxAmount, settings.currency)}</strong>
                </div>
                <div className="summary-row total-row">
                  <span>Final Total</span>
                  <strong>{formatCurrency(finalTotal, settings.currency)}</strong>
                </div>
              </div>

              {paymentMethod === "cash" && (
                <div className="checkout-card">
                  <label className="checkout-label">Cash Received</label>
                  <input
                    className="large-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                  />
                  <div className="summary-row" style={{ marginTop: 12 }}>
                    <span>Change</span>
                    <strong>
                      {Number.isFinite(changeAmount)
                        ? formatCurrency(changeAmount, settings.currency)
                        : "—"}
                    </strong>
                  </div>
                  {!cashSufficient && cashReceived !== "" && (
                    <div className="field-error">Cash received is less than the total.</div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={processing}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={completeSale}
                disabled={processing || (paymentMethod === "cash" && !cashSufficient)}
              >
                {processing ? "Processing..." : "Complete Sale"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReceipt && (
        <div className="modal-overlay">
          <div className="checkout-modal" style={{ width: 520 }}>
            {receiptLoading ? (
              <p>Loading receipt...</p>
            ) : receiptError ? (
              <p style={{ color: "red" }}>{receiptError}</p>
            ) : (
              <div>
                <Receipt sale={receiptSale} />

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowReceipt(false);
                      setReceiptSale(null);
                    }}
                  >
                    Close
                  </button>
                  <button className="btn btn-primary" onClick={() => window.print()}>
                    Print Receipt
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default POS;