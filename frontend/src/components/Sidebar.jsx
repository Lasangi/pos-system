function Sidebar({ currentPage, setCurrentPage, user }) {
  const navItems = [
    { key: "dashboard", label: "Dashboard" },
    { key: "pos", label: "POS" },
    { key: "products", label: "Products" },
    { key: "inventory", label: "Inventory" },
    { key: "sales", label: "Sales" },
    { key: "customers", label: "Customers" },
    { key: "reports", label: "Reports" },
    { key: "settings", label: "Settings" },
    { key: "users", label: "User Management" },
  ];

  const visibleNavItems = user?.role === "admin"
    ? navItems
    : navItems.filter((item) => item.key !== "settings" && item.key !== "users");

  return (
    <aside className="sidebar">
      <h2>MY POS</h2>
      <div className="sidebar-user-badge">{user?.role === "admin" ? "Admin Access" : "Cashier Access"}</div>

      <nav>
        {visibleNavItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`nav-button ${currentPage === item.key ? "active" : ""}`}
            onClick={() => setCurrentPage(item.key)}
            aria-current={currentPage === item.key ? "page" : undefined}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;