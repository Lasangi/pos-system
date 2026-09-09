function Sidebar({ currentPage, setCurrentPage }) {
  return (
    <aside className="sidebar">
      <h2>MY POS</h2>

      <nav>
        <button onClick={() => setCurrentPage("dashboard")}>
          Dashboard
        </button>

        <button onClick={() => setCurrentPage("pos")}>
          POS
        </button>

        <button onClick={() => setCurrentPage("products")}>
          Products
        </button>

        <button onClick={() => setCurrentPage("inventory")}>
          Inventory
        </button>

        <button onClick={() => setCurrentPage("sales")}>
          Sales
        </button>

        <button onClick={() => setCurrentPage("customers")}>
          Customers
        </button>

        <button onClick={() => setCurrentPage("reports")}>
          Reports
        </button>

        <button onClick={() => setCurrentPage("settings")}>
          Settings
        </button>
      </nav>
    </aside>
  );
}

export default Sidebar;