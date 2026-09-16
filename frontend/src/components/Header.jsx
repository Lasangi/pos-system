function Header({ user, onLogout }) {
  const roleLabel = user?.role === "admin" ? "Admin" : "Cashier";

  return (
    <header className="header">
      <h1>My POS System</h1>
      <div className="header-user-panel">
        <div className="header-user-meta">
          <strong>{user?.full_name || user?.username || "User"}</strong>
          <span>{roleLabel}</span>
        </div>
        {onLogout && (
          <button type="button" className="btn btn-secondary" onClick={onLogout}>
            Logout
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;