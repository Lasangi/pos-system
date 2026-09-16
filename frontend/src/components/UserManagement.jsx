import { useEffect, useState } from "react";

const API_BASE = "http://localhost:5000/api/auth";

function UserManagement({ user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [changePasswordUser, setChangePasswordUser] = useState(null);
  const [passwordValue, setPasswordValue] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    username: "",
    email: "",
    password: "",
    role: "cashier",
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);

  async function fetchUsers() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/users`, {
        credentials: "include",
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load users");
      }

      setUsers(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  function openCreateForm() {
    setEditingUser(null);
    setForm({
      full_name: "",
      username: "",
      email: "",
      password: "",
      role: "cashier",
      is_active: true,
    });
    setShowForm(true);
  }

  function openEditForm(selectedUser) {
    setEditingUser(selectedUser);
    setForm({
      full_name: selectedUser.full_name || "",
      username: selectedUser.username || "",
      email: selectedUser.email || "",
      password: "",
      role: selectedUser.role || "cashier",
      is_active: Boolean(selectedUser.is_active),
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingUser(null);
    setForm({
      full_name: "",
      username: "",
      email: "",
      password: "",
      role: "cashier",
      is_active: true,
    });
  }

  function handleFormChange(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitUserForm(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const fullName = (form.full_name || "").trim();
      const username = (form.username || "").trim();
      const email = (form.email || "").trim();
      const password = (form.password || "").trim();

      if (!fullName) {
        throw new Error("Full name is required.");
      }

      if (!username) {
        throw new Error("Username is required.");
      }

      if (!editingUser && !password) {
        throw new Error("Password is required for new users.");
      }

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Please enter a valid email address.");
      }

      const payload = {
        full_name: fullName,
        username,
        email: email || null,
        role: form.role,
        is_active: form.is_active,
      };

      if (!editingUser) {
        payload.password = password;
      }

      const method = editingUser ? "PUT" : "POST";
      const url = editingUser ? `${API_BASE}/users/${editingUser.id}` : `${API_BASE}/users`;

      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || `Failed to ${editingUser ? "update" : "create"} user.`);
      }

      setSuccess(editingUser ? "User updated successfully." : "User created successfully.");
      closeForm();
      await fetchUsers();
    } catch (submitError) {
      setError(submitError.message || "Failed to save user.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleUserStatus(selectedUser) {
    const nextState = !Boolean(selectedUser.is_active);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_BASE}/users/${selectedUser.id}/status`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextState }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to update user status.");
      }

      setSuccess(nextState ? "User activated successfully." : "User deactivated successfully.");
      await fetchUsers();
    } catch (statusError) {
      setError(statusError.message || "Failed to update user status.");
    }
  }

  async function changePassword() {
    if (!changePasswordUser) return;

    const newPassword = passwordValue.trim();
    if (!newPassword || newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_BASE}/users/${changePasswordUser.id}/password`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to change password.");
      }

      setSuccess("Password changed successfully.");
      setPasswordValue("");
      setChangePasswordUser(null);
    } catch (passwordError) {
      setError(passwordError.message || "Failed to change password.");
    }
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="user-management-page">
        <div className="empty-state">
          <h3>Access denied</h3>
          <p>Only administrators can access user management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-management-page">
      <div className="page-header">
        <h2>User Management</h2>
        <button type="button" className="btn btn-primary" onClick={openCreateForm}>
          + Add User
        </button>
      </div>

      {error && <div className="error-box empty-state">{error}</div>}
      {success && <div className="success-box empty-state">{success}</div>}

      {showForm && (
        <div className="modal-overlay">
          <div className="checkout-modal user-form-modal">
            <h3>{editingUser ? "Edit User" : "Create User"}</h3>

            <form onSubmit={submitUserForm} className="user-form-grid">
              <label>
                Full Name
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(event) => handleFormChange("full_name", event.target.value)}
                />
              </label>

              <label>
                Username
                <input
                  type="text"
                  value={form.username}
                  onChange={(event) => handleFormChange("username", event.target.value)}
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => handleFormChange("email", event.target.value)}
                />
              </label>

              {!editingUser && (
                <label>
                  Password
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => handleFormChange("password", event.target.value)}
                  />
                </label>
              )}

              <label>
                Role
                <select value={form.role} onChange={(event) => handleFormChange("role", event.target.value)}>
                  <option value="admin">Admin</option>
                  <option value="cashier">Cashier</option>
                </select>
              </label>

              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={Boolean(form.is_active)}
                  onChange={(event) => handleFormChange("is_active", event.target.checked)}
                />
                Active
              </label>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Saving..." : editingUser ? "Save Changes" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {changePasswordUser && (
        <div className="modal-overlay">
          <div className="checkout-modal user-form-modal">
            <h3>Change Password</h3>
            <div className="user-form-grid">
              <label>
                New password for {changePasswordUser.full_name || changePasswordUser.username}
                <input
                  type="password"
                  value={passwordValue}
                  onChange={(event) => setPasswordValue(event.target.value)}
                  placeholder="Minimum 6 characters"
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setChangePasswordUser(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={changePassword}>
                  Save Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty-state">Loading users...</div>
      ) : (
        <div className="table-card">
          <table className="sales-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", padding: 20 }}>
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((item) => (
                  <tr key={item.id}>
                    <td>{item.full_name || "—"}</td>
                    <td>{item.username}</td>
                    <td>{item.email || "—"}</td>
                    <td>{item.role === "admin" ? "Admin" : "Cashier"}</td>
                    <td>
                      <span className={item.is_active ? "status active-status" : "status inactive-status"}>
                        {item.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}</td>
                    <td>
                      <div className="table-actions compact-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => openEditForm(item)}>
                          Edit
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => setChangePasswordUser(item)}>
                          Change Password
                        </button>
                        <button
                          type="button"
                          className={item.is_active ? "btn btn-secondary" : "btn btn-primary"}
                          onClick={() => toggleUserStatus(item)}
                        >
                          {item.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
