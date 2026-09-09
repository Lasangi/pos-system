import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:5000/api/reports";
const DEFAULT_SETTINGS = { currency: "LKR" };

function formatMoney(value, currency = "LKR") {
  const amount = Number(value || 0);
  return `${currency} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateInput(date) {
  if (!date) return "";
  const d = new Date(date);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function getDateRange(type) {
  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);

  if (type === "today") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  if (type === "yesterday") {
    start.setDate(today.getDate() - 1);
    end.setDate(today.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  if (type === "last7") {
    start.setDate(today.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  if (type === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(today.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  }

  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(end),
  };
}

function buildQueryString(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) {
      search.append(key, value);
    }
  });
  const q = search.toString();
  return q ? `?${q}` : "";
}

function Reports() {
  const [summary, setSummary] = useState(null);
  const [salesSummary, setSalesSummary] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_SETTINGS.currency);

  const fetchReports = async (queryString = "") => {
    try {
      const [summaryResponse, salesResponse, paymentResponse, topProductsResponse, inventoryResponse] = await Promise.all([
        fetch(`${API_BASE}/summary`),
        fetch(`${API_BASE}/sales${queryString}`),
        fetch(`${API_BASE}/payment-methods${queryString}`),
        fetch(`${API_BASE}/top-products${queryString}`),
        fetch(`${API_BASE}/inventory`),
      ]);

      if (!summaryResponse.ok) throw new Error("Failed to load summary data");
      if (!salesResponse.ok) throw new Error("Failed to load sales summary");
      if (!paymentResponse.ok) throw new Error("Failed to load payment method report");
      if (!topProductsResponse.ok) throw new Error("Failed to load top products report");
      if (!inventoryResponse.ok) throw new Error("Failed to load inventory summary");

      const summaryData = await summaryResponse.json();
      const salesData = await salesResponse.json();
      const paymentData = await paymentResponse.json();
      const topProductsData = await topProductsResponse.json();
      const inventoryData = await inventoryResponse.json();

      setSummary(summaryData);
      setSalesSummary(Array.isArray(salesData) ? salesData : []);
      setPaymentMethods(Array.isArray(paymentData) ? paymentData : []);
      setTopProducts(Array.isArray(topProductsData) ? topProductsData : []);
      setInventory(inventoryData);
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch("http://localhost:5000/api/settings")
      .then((response) => response.json())
      .then((data) => setCurrency((data && data.currency) || DEFAULT_SETTINGS.currency))
      .catch(() => setCurrency(DEFAULT_SETTINGS.currency));

    const range = getDateRange("today");
    const query = buildQueryString(range);
    fetchReports(query);
  }, []);

  const loadFilterData = (selectedFilter) => {
    setFilter(selectedFilter);

    if (selectedFilter === "custom") {
      if (!customStart || !customEnd) {
        return;
      }
      const query = buildQueryString({ startDate: customStart, endDate: customEnd });
      fetchReports(query);
      return;
    }

    const range = getDateRange(selectedFilter);
    const query = buildQueryString(range);
    fetchReports(query);
  };

  const maximumSales = useMemo(() => {
    if (salesSummary.length === 0) return 0;
    return Math.max(...salesSummary.map((item) => Number(item.totalSales || 0)));
  }, [salesSummary]);

  const exportCsv = () => {
    if (!salesSummary.length) return;

    const rows = [
      ["Date", "Orders", "Total Sales", "Average Order Value"],
      ...salesSummary.map((item) => [
        item.date,
        item.orders,
        Number(item.totalSales || 0).toFixed(2),
        Number(item.averageOrderValue || 0).toFixed(2),
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sales-report.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="reports-page">
        <div className="page-header">
          <h2>Reports</h2>
        </div>
        <div className="empty-state">Loading reports...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="reports-page">
        <div className="page-header">
          <h2>Reports</h2>
        </div>
        <div className="empty-state error-box">
          <p>{error}</p>
          <button className="btn btn-secondary" onClick={() => fetchReports()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const noSales = !summary || Number(summary.totalOrders) === 0;

  return (
    <div className="reports-page">
      <div className="page-header">
        <h2>Reports</h2>
      </div>

      {noSales ? (
        <div className="empty-state">
          <p>No sales data available.</p>
        </div>
      ) : (
        <>
          <section className="report-grid">
            <div className="report-card">
              <span className="report-label">Total Sales</span>
              <strong>{formatMoney(summary.totalSales, currency)}</strong>
            </div>
            <div className="report-card">
              <span className="report-label">Transactions</span>
              <strong>{summary.totalOrders}</strong>
            </div>
            <div className="report-card">
              <span className="report-label">Total Items Sold</span>
              <strong>{summary.totalItemsSold}</strong>
            </div>
            <div className="report-card">
              <span className="report-label">Average Transaction Value</span>
              <strong>{formatMoney(summary.averageOrderValue, currency)}</strong>
            </div>
            <div className="report-card">
              <span className="report-label">Today&apos;s Sales</span>
              <strong>{formatMoney(summary.todaysSales, currency)}</strong>
            </div>
            <div className="report-card">
              <span className="report-label">This Week&apos;s Sales</span>
              <strong>{formatMoney(summary.thisWeekSales, currency)}</strong>
            </div>
            <div className="report-card">
              <span className="report-label">This Month&apos;s Sales</span>
              <strong>{formatMoney(summary.thisMonthSales, currency)}</strong>
            </div>
          </section>

          <section className="report-panel">
            <div className="section-header">
              <h3>Sales Summary</h3>
              <button className="btn btn-primary" onClick={exportCsv}>
                Export CSV
              </button>
            </div>

            <div className="filter-group">
              {[
                { label: "Today", value: "today" },
                { label: "Yesterday", value: "yesterday" },
                { label: "Last 7 Days", value: "last7" },
                { label: "This Month", value: "month" },
                { label: "Custom", value: "custom" },
              ].map((item) => (
                <button
                  key={item.value}
                  className={`btn ${filter === item.value ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => {
                    if (item.value === "custom") {
                      setFilter("custom");
                      return;
                    }
                    loadFilterData(item.value);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {filter === "custom" && (
              <div className="custom-range">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => loadFilterData("custom")}
                  disabled={!customStart || !customEnd}
                >
                  Apply
                </button>
              </div>
            )}

            <div className="table-card">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Orders</th>
                    <th>Total Sales</th>
                    <th>Average Order Value</th>
                  </tr>
                </thead>
                <tbody>
                  {salesSummary.map((row) => (
                    <tr key={row.date}>
                      <td>{row.date}</td>
                      <td>{row.orders}</td>
                      <td>{formatMoney(row.totalSales, currency)}</td>
                      <td>{formatMoney(row.averageOrderValue, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="report-panel">
            <h3>Payment Method Report</h3>
            <div className="table-card">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Payment Method</th>
                    <th>Transactions</th>
                    <th>Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentMethods.map((row) => (
                    <tr key={row.paymentMethod}>
                      <td>{row.paymentMethod}</td>
                      <td>{row.transactions}</td>
                      <td>{formatMoney(row.total, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="report-panel">
            <h3>Top Selling Products</h3>
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
                  {topProducts.map((row, index) => (
                    <tr key={`${row.name}-${index}`}>
                      <td>{row.name}</td>
                      <td>{row.quantitySold}</td>
                      <td>{formatMoney(row.revenue, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="report-panel">
            <h3>Inventory Summary</h3>
            <div className="report-grid inventory-grid">
              <div className="report-card">
                <span className="report-label">Total Products</span>
                <strong>{inventory?.totalProducts ?? 0}</strong>
              </div>
              <div className="report-card">
                <span className="report-label">Total Stock Units</span>
                <strong>{inventory?.totalStockUnits ?? 0}</strong>
              </div>
              <div className="report-card">
                <span className="report-label">Low-stock Products</span>
                <strong>{inventory?.lowStockProducts ?? 0}</strong>
              </div>
              <div className="report-card">
                <span className="report-label">Out-of-stock Products</span>
                <strong>{inventory?.outOfStockProducts ?? 0}</strong>
              </div>
            </div>
          </section>

          <section className="report-panel">
            <h3>Sales Over Time</h3>
            <div className="chart-bars">
              {salesSummary.length === 0 ? (
                <p>No sales in selected range.</p>
              ) : (
                salesSummary.map((row) => (
                  <div className="chart-row" key={row.date}>
                    <div className="chart-label">{row.date}</div>
                    <div className="chart-track">
                      <div
                        className="chart-bar"
                        style={{ width: `${Math.max((Number(row.totalSales) / maximumSales) * 100, 8)}%` }}
                      />
                    </div>
                    <div className="chart-value">{formatMoney(row.totalSales, currency)}</div>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default Reports;
