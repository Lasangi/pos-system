import { useEffect, useMemo, useState } from "react";

const DEFAULT_CURRENCY = "LKR";

function formatMoney(value, currency = DEFAULT_CURRENCY) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Dashboard({ setCurrentPage }) {
  const [dashboard, setDashboard] = useState(null);
  const [settings, setSettings] = useState({ currency: DEFAULT_CURRENCY });
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [selectedSaleDetails, setSelectedSaleDetails] = useState(null);

  const fetchDashboard = async (nextPeriod = period) => {
    if (!nextPeriod) {
      return;
    }

    setRefreshing(true);
    setError("");

    try {
      const [dashboardRes, settingsRes] = await Promise.all([
        fetch(`http://localhost:5000/api/dashboard?range=${encodeURIComponent(nextPeriod)}`),
        fetch("http://localhost:5000/api/settings")
      ]);

      if (!dashboardRes.ok) {
        throw new Error("Failed to load dashboard data");
      }

      if (!settingsRes.ok) {
        throw new Error("Failed to load settings");
      }

      const dashboardData = await dashboardRes.json();
      const settingsData = await settingsRes.json();

      setDashboard(dashboardData || { stats: {}, salesOverview: [], recentSales: [], topProducts: [], lowStockProducts: [] });
      setSettings({ currency: settingsData?.currency || DEFAULT_CURRENCY });
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard(period);
  }, []);

  const handlePeriodChange = (nextPeriod) => {
    setPeriod(nextPeriod);
    fetchDashboard(nextPeriod);
  };

  const openSaleDetails = async (saleId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/sales/${saleId}`);
      if (!response.ok) {
        throw new Error("Failed to load sale details");
      }
      const data = await response.json();
      setSelectedSaleId(saleId);
      setSelectedSaleDetails(data);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.message || "Failed to load sale details");
    }
  };

  const maxOverviewSales = useMemo(() => {
    if (!dashboard?.salesOverview?.length) return 0;
    return Math.max(...dashboard.salesOverview.map((row) => Number(row.salesAmount || 0)));
  }, [dashboard]);

  const overviewRows = dashboard?.salesOverview || [];
  const stats = dashboard?.stats || {};
  const recentSales = dashboard?.recentSales || [];
  const topProducts = dashboard?.topProducts || [];
  const lowStockProducts = dashboard?.lowStockProducts || [];

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-header-row">
          <h2>Dashboard</h2>
          <button className="btn btn-primary" disabled>
            Refreshing...
          </button>
        </div>
        <div className="empty-state">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-header-row">
          <h2>Dashboard</h2>
          <button className="btn btn-primary" onClick={() => fetchDashboard(period)}>
            Refresh
          </button>
        </div>
        <div className="empty-state error-box">
          <p>{error}</p>
          <button className="btn btn-secondary" onClick={() => fetchDashboard(period)}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header-row">
        <h2>Dashboard</h2>
        <div className="dashboard-actions">
          <button className="btn btn-secondary" onClick={() => fetchDashboard(period)} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="quick-actions">
        <button className="btn btn-primary" onClick={() => setCurrentPage("pos")}>New Sale</button>
        <button className="btn btn-secondary" onClick={() => setCurrentPage("products")}>Add Product</button>
        <button className="btn btn-secondary" onClick={() => setCurrentPage("inventory")}>Inventory</button>
        <button className="btn btn-secondary" onClick={() => setCurrentPage("customers")}>Customers</button>
        <button className="btn btn-secondary" onClick={() => setCurrentPage("reports")}>Reports</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Today&apos;s Sales</span>
          <strong>{formatMoney(stats.todaysSales, settings.currency)}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Sales</span>
          <strong>{formatMoney(stats.totalSales, settings.currency)}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Today&apos;s Transactions</span>
          <strong>{stats.todaysTransactions ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Transactions</span>
          <strong>{stats.totalTransactions ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Products</span>
          <strong>{stats.totalProducts ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Stock Units</span>
          <strong>{stats.totalStockUnits ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Low Stock Products</span>
          <strong>{stats.lowStockProducts ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Out-of-Stock Products</span>
          <strong>{stats.outOfStockProducts ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Customers</span>
          <strong>{stats.totalCustomers ?? 0}</strong>
        </div>
      </div>

      <div className="content-grid">
        <section className="panel-card">
          <div className="panel-header">
            <h3>Sales Overview</h3>
            <div className="filter-group compact">
              {[
                { label: "Today", value: "today" },
                { label: "Last 7 Days", value: "7d" },
                { label: "This Month", value: "month" },
              ].map((option) => (
                <button
                  key={option.value}
                  className={`btn ${period === option.value ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => handlePeriodChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {overviewRows.length === 0 ? (
            <div className="empty-state">No sales data available for this period.</div>
          ) : (
            <div className="table-card">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Sales Amount</th>
                    <th>Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {overviewRows.map((row) => (
                    <tr key={row.date}>
                      <td>{row.date}</td>
                      <td>{formatMoney(row.salesAmount, settings.currency)}</td>
                      <td>{row.transactionCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="sales-bars">
                {overviewRows.map((row) => (
                  <div className="sales-bar-row" key={row.date}>
                    <span>{row.date}</span>
                    <div className="sales-bar-track">
                      <div
                        className="sales-bar"
                        style={{ width: `${maxOverviewSales > 0 ? (Number(row.salesAmount || 0) / maxOverviewSales) * 100 : 0}%` }}
                      />
                    </div>
                    <strong>{formatMoney(row.salesAmount, settings.currency)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="panel-card">
          <div className="panel-header">
            <h3>Recent Sales</h3>
          </div>

          {recentSales.length === 0 ? (
            <div className="empty-state">No recent sales found.</div>
          ) : (
            <div className="table-card">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Sale ID</th>
                    <th>Date/Time</th>
                    <th>Payment</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale) => (
                    <tr key={sale.id} onClick={() => openSaleDetails(sale.id)} className="clickable-row">
                      <td>#{sale.id}</td>
                      <td>{formatDateTime(sale.created_at)}</td>
                      <td>{sale.payment_method}</td>
                      <td>{formatMoney(sale.total, settings.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel-card">
          <div className="panel-header">
            <h3>Top Products</h3>
          </div>

          {topProducts.length === 0 ? (
            <div className="empty-state">No product sales yet.</div>
          ) : (
            <div className="table-card">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Quantity Sold</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((product) => (
                    <tr key={product.name}>
                      <td>{product.name}</td>
                      <td>{product.quantitySold}</td>
                      <td>{formatMoney(product.revenue, settings.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel-card">
          <div className="panel-header">
            <h3>Low Stock Alert</h3>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="empty-state">No products are at or below the current threshold.</div>
          ) : (
            <div className="table-card">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Current Stock</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockProducts.map((product) => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{product.stock}</td>
                      <td>
                        <span className={product.isOutOfStock ? "status out" : "status low"}>
                          {product.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selectedSaleDetails && (
        <div className="modal-overlay" onClick={() => setSelectedSaleDetails(null)}>
          <div className="checkout-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Sale Details</h3>
            <div className="sale-detail-header">
              <div>
                <strong>Sale #{selectedSaleDetails.sale.id}</strong>
              </div>
              <div>{formatDateTime(selectedSaleDetails.sale.created_at)}</div>
            </div>

            <div className="summary-row">
              <span>Customer</span>
              <strong>{selectedSaleDetails.sale.customer_name || "Walk-in Customer"}</strong>
            </div>
            <div className="summary-row">
              <span>Payment</span>
              <strong>{selectedSaleDetails.sale.payment_method}</strong>
            </div>

            <div className="sale-items-list">
              {selectedSaleDetails.items.map((item) => (
                <div key={`${item.product_id}-${item.name}`} className="sale-item-row">
                  <span>{item.name} × {item.quantity}</span>
                  <strong>{formatMoney(item.subtotal, settings.currency)}</strong>
                </div>
              ))}
            </div>

            <div className="summary-row total-row">
              <span>Total</span>
              <strong>{formatMoney(selectedSaleDetails.sale.total, settings.currency)}</strong>
            </div>

            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setSelectedSaleDetails(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;