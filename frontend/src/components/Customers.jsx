import { useEffect, useMemo, useState } from "react";

const API = "http://localhost:5000/api/customers";

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
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

    if (!form.name || !form.name.trim()) {
      setError("Customer name is required");
      return;
    }

    const payload = {
      name: form.name.trim(),
      phone: form.phone ? form.phone.trim() : "",
      email: form.email ? form.email.trim() : "",
      address: form.address ? form.address.trim() : "",
      notes: form.notes ? form.notes.trim() : "",
    };

    const method = form.id ? "PUT" : "POST";
    const url = form.id ? `${API}/${form.id}` : API;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `Failed to ${form.id ? "update" : "add"} customer`);
      }

      setShowForm(false);
      setError("");
      fetchList();
    } catch (err) {
      setError(err.message || `Failed to ${form.id ? "update" : "add"} customer`);
    }
  }

  async function handleDelete(id) {
    const confirmed = window.confirm("Delete this customer?");
    if (!confirmed) return;

    try {
      const response = await fetch(`${API}/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to delete customer");
      }

      fetchList();
    } catch (err) {
      setError(err.message || "Failed to delete customer");
    }
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
                      <button className="btn btn-secondary" onClick={() => openEdit(customer)}>
                        Edit
                      </button>
                      <button className="btn btn-danger" onClick={() => handleDelete(customer.id)}>
                        Delete
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
                <button type="submit" className="btn btn-primary">
                  {form.id ? "Save Changes" : "Add Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Customers;
