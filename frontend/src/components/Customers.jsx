import { useEffect, useMemo, useState } from "react";

const API = "http://localhost:5000/api/customers";

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [selectedSale, setSelectedSale] = useState(null);
  const [saleDetailLoading, setSaleDetailLoading] = useState(false);
  const [saleDetailError, setSaleDetailError] = useState("");
  const [form, setForm] = useState({
    id: null,
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });

  useEffect(() => {
    fetchList();
  }, []);

  function validateCustomerInput(values) {
    const name = (values.name || "").trim();
    const email = (values.email || "").trim();

    if (!name) {
      return "Customer name is required";
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "Please enter a valid email address";
    }

    return "";
  }

  async function fetchList() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load customers");
      }

      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load customers");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return customers;

    return customers.filter((customer) => {
      const name = String(customer.name || "").toLowerCase();
      const phone = String(customer.phone || "").toLowerCase();
      const email = String(customer.email || "").toLowerCase();
      return name.includes(query) || phone.includes(query) || email.includes(query);
    });
  }, [customers, search]);

  function openNew() {
    setForm({
      id: null,
      name: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
    });
    setShowForm(true);
  }

  function openEdit(customer) {
    setForm({
      id: customer.id,
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const validationError = validateCustomerInput(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      name: (form.name || "").trim(),
      phone: (form.phone || "").trim(),
      email: (form.email || "").trim(),
      address: (form.address || "").trim(),
      notes: (form.notes || "").trim(),
    };

    const method = form.id ? "PUT" : "POST";
    const url = form.id ? `${API}/${form.id}` : API;

    setSubmitLoading(true);
    setError("");

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let data = {};
      try {
        data = await response.json();
      } catch (jsonError) {
        // Ignore JSON parse failures for non-JSON error responses.
      }

      if (!response.ok) {
        throw new Error(data?.error || `Failed to ${form.id ? "update" : "add"} customer`);
      }

      setShowForm(false);
      setError("");
      await fetchList();
    } catch (err) {
      setError(err.message || `Failed to ${form.id ? "update" : "add"} customer`);
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleDelete(id) {
    const customer = customers.find((item) => item.id === id);
    const customerName = customer?.name ? `"${customer.name}"` : "this customer";
    const confirmed = window.confirm(`Delete customer ${customerName}? This action cannot be completed if the customer already has sales history.`);
    if (!confirmed) return;

    setDeleteLoadingId(id);
    setError("");

    try {
      const response = await fetch(`${API}/${id}`, {
        method: "DELETE",
      });

      let data = {};
      try {
        data = await response.json();
      } catch (jsonError) {
        // Ignore JSON parse failures for non-JSON error responses.
      }

      if (!response.ok) {
        throw new Error(data?.error || "Failed to delete customer");
      }

      await fetchList();
    } catch (err) {
      setError(err.message || "Failed to delete customer");
    } finally {
      setDeleteLoadingId(null);
    }
  }

  async function openCustomerDetails(customer) {
    setSelectedCustomer({ ...customer, purchaseHistory: [] });
    setSelectedSale(null);
    setSaleDetailError("");
    setDetailError("");
    setDetailLoading(true);

    try {
      const customerResponse = await fetch(`${API}/${customer.id}`);
      const customerData = await customerResponse.json();

      if (!customerResponse.ok) {
        throw new Error(customerData?.error || "Failed to load customer details");
      }

      const salesResponse = await fetch(`${API}/${customer.id}/sales`);
      const salesData = await salesResponse.json();

      if (!salesResponse.ok) {
        throw new Error(salesData?.error || "Failed to load customer purchase history");
      }

      setSelectedCustomer({
        ...customerData,
        purchaseHistory: Array.isArray(salesData) ? salesData : [],
      });
    } catch (err) {
      setDetailError(err.message || "Failed to load customer details");
    } finally {
      setDetailLoading(false);
    }
  }

  async function openSaleDetails(saleId) {
    setSaleDetailLoading(true);
    setSaleDetailError("");
    setSelectedSale(null);

    try {
      const response = await fetch(`http://localhost:5000/api/sales/${saleId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load sale details");
      }

      setSelectedSale(data);
    } catch (err) {
      setSaleDetailError(err.message || "Failed to load sale details");
    } finally {
      setSaleDetailLoading(false);
    }
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  }

  function formatDate(dateString) {
    if (!dateString) return "—";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="customers-page">
      <div className="page-header">
        <h2>Customers</h2>
        <button className="btn btn-primary" onClick={openNew}>
          Add Customer
        </button>
      </div>

      <div className="panel-toolbar">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone or email"
          className="search-input"
        />
      </div>

      {loading && <p className="empty-state">Loading customers...</p>}

      {!loading && error && (
        <div className="empty-state error-box">
          <p>{error}</p>
          <button className="btn btn-secondary" onClick={fetchList}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && filteredCustomers.length === 0 && (
        <div className="empty-state">
          <p>No customers match your search.</p>
        </div>
      )}

      {!loading && !error && filteredCustomers.length > 0 && (
        <div className="table-card">
          <table className="sales-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Address</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.id}</td>
                  <td>{customer.name}</td>
                  <td>{customer.phone || "-"}</td>
                  <td>{customer.email || "-"}</td>
                  <td>{customer.address || "-"}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-secondary" onClick={() => openCustomerDetails(customer)}>
                        Details
                      </button>
                      <button className="btn btn-secondary" onClick={() => openEdit(customer)}>
                        Edit
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(customer.id)}
                        disabled={deleteLoadingId === customer.id}
                      >
                        {deleteLoadingId === customer.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay">
          <div className="checkout-modal" style={{ width: "420px" }}>
            <h3>{form.id ? "Edit Customer" : "Add Customer"}</h3>
            <form onSubmit={handleSubmit}>
              <div className="checkout-sections">
                <div className="checkout-field">
                  <label className="checkout-label">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Customer name"
                  />
                </div>

                <div className="checkout-field">
                  <label className="checkout-label">Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>

                <div className="checkout-field">
                  <label className="checkout-label">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="customer@example.com"
                  />
                </div>

                <div className="checkout-field">
                  <label className="checkout-label">Address</label>
                  <textarea
                    rows="3"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Customer address"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db" }}
                  />
                </div>

                <div className="checkout-field">
                  <label className="checkout-label">Notes</label>
                  <textarea
                    rows="3"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Optional notes"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db" }}
                  />
                </div>
              </div>

              {error && <div className="field-error">{error}</div>}

              <div className="modal-actions" style={{ marginTop: "18px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                  {submitLoading ? (form.id ? "Saving..." : "Adding...") : (form.id ? "Save Changes" : "Add Customer")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedCustomer && (
        <div className="modal-overlay">
          <div className="checkout-modal" style={{ width: "760px", maxWidth: "90vw" }}>
            <div className="modal-actions" style={{ marginBottom: "12px", justifyContent: "space-between" }}>
              <button className="btn btn-secondary" onClick={() => setSelectedCustomer(null)}>
                Back to Customer List
              </button>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="btn btn-secondary" onClick={() => {
                  setSelectedCustomer(null);
                  openEdit(selectedCustomer);
                }}>
                  Edit Customer
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    setSelectedCustomer(null);
                    handleDelete(selectedCustomer.id);
                  }}
                >
                  Delete Customer
                </button>
              </div>
            </div>

            {detailError ? (
              <div className="field-error">{detailError}</div>
            ) : detailLoading ? (
              <p>Loading customer details...</p>
            ) : (
              <>
                <h3>{selectedCustomer.name}</h3>
                <div style={{ display: "grid", gap: "6px", marginBottom: "20px" }}>
                  <div>📞 {selectedCustomer.phone || "—"}</div>
                  <div>✉️ {selectedCustomer.email || "—"}</div>
                  <div>📍 {selectedCustomer.address || "—"}</div>
                  <div>📝 {selectedCustomer.notes || "—"}</div>
                </div>

                <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
                  <h4 style={{ margin: "0 0 12px 0" }}>Purchase History</h4>

                  {selectedCustomer.purchaseHistory && selectedCustomer.purchaseHistory.length > 0 ? (
                    <>
                      <table className="sales-table" style={{ marginBottom: "12px" }}>
                        <thead>
                          <tr>
                            <th>Sale ID</th>
                            <th>Date</th>
                            <th>Total</th>
                            <th>Payment</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCustomer.purchaseHistory.map((sale) => (
                            <tr key={sale.id}>
                              <td>#{sale.id}</td>
                              <td>{formatDate(sale.created_at)}</td>
                              <td>{formatCurrency(sale.total)}</td>
                              <td>{sale.payment_method || "—"}</td>
                              <td>
                                <button className="btn btn-secondary" onClick={() => openSaleDetails(sale.id)}>
                                  View Details
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", paddingTop: "8px" }}>
                        <strong>Number of purchases: {selectedCustomer.purchaseHistory.length}</strong>
                        <strong>Total amount spent: {formatCurrency(selectedCustomer.purchaseHistory.reduce((sum, sale) => sum + Number(sale.total || 0), 0))}</strong>
                      </div>
                    </>
                  ) : (
                    <p>No purchases yet.</p>
                  )}
                </div>

                {saleDetailError && <div className="field-error" style={{ marginTop: "12px" }}>{saleDetailError}</div>}

                {saleDetailLoading && <p style={{ marginTop: "12px" }}>Loading sale details...</p>}

                {selectedSale && (
                  <div style={{ borderTop: "1px solid #e5e7eb", marginTop: "16px", paddingTop: "16px" }}>
                    <h4 style={{ margin: "0 0 12px 0" }}>Sale #{selectedSale.sale.id}</h4>
                    <div style={{ display: "grid", gap: "4px", marginBottom: "12px" }}>
                      <div>Date: {new Date(selectedSale.sale.created_at).toLocaleString()}</div>
                      <div>Payment: {selectedSale.sale.payment_method}</div>
                      <div>Customer: {selectedSale.sale.customer_name || "Walk-in Customer"}</div>
                    </div>

                    <table className="sales-table" style={{ marginBottom: "12px" }}>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Qty</th>
                          <th>Price</th>
                          <th>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSale.items.map((item) => (
                          <tr key={`${selectedSale.sale.id}-${item.product_id}`}>
                            <td>{item.name}</td>
                            <td>{item.quantity}</td>
                            <td>{formatCurrency(item.price)}</td>
                            <td>{formatCurrency(item.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div style={{ textAlign: "right" }}>
                      <strong>Total: {formatCurrency(selectedSale.sale.total)}</strong>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Customers;
