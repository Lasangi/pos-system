import { useEffect, useState } from "react";

const API = "http://localhost:5000/api/settings";

const defaultState = {
  storeName: "My POS Store",
  storeAddress: "",
  storePhone: "",
  storeEmail: "",
  currency: "LKR",
  taxEnabled: false,
  taxRate: 0,
  defaultPaymentMethod: "Cash",
  allowNegativeStock: false,
  lowStockThreshold: 10,
  receiptShowStoreInfo: true,
  receiptShowDateTime: true,
  receiptShowCashier: false,
  receiptFooter: "Thank you for your purchase!",
};

function Settings() {
  const [settings, setSettings] = useState(defaultState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(API);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load settings");
      }
      setSettings({ ...defaultState, ...data });
    } catch (err) {
      setError(err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field, value) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        ...settings,
        taxRate: Number(settings.taxRate),
        lowStockThreshold: Number(settings.lowStockThreshold),
      };

      const response = await fetch(API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to save settings");
      }

      setSettings({ ...defaultState, ...data });
      setSuccess("Settings saved successfully.");
    } catch (err) {
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <h2>Settings</h2>
      </div>

      {loading ? (
        <div className="empty-state">Loading settings...</div>
      ) : (
        <>
          {error && <div className="error-box empty-state">{error}</div>}
          {success && <div className="success-box empty-state">{success}</div>}

          <div className="settings-grid">
            <section className="report-panel">
              <h3>Store Information</h3>
              <div className="settings-form">
                <label>
                  Store name
                  <input
                    type="text"
                    value={settings.storeName}
                    onChange={(e) => handleChange("storeName", e.target.value)}
                  />
                </label>

                <label>
                  Store address
                  <textarea
                    rows="3"
                    value={settings.storeAddress}
                    onChange={(e) => handleChange("storeAddress", e.target.value)}
                  />
                </label>

                <div className="settings-row">
                  <label>
                    Phone number
                    <input
                      type="text"
                      value={settings.storePhone}
                      onChange={(e) => handleChange("storePhone", e.target.value)}
                    />
                  </label>

                  <label>
                    Email
                    <input
                      type="email"
                      value={settings.storeEmail}
                      onChange={(e) => handleChange("storeEmail", e.target.value)}
                    />
                  </label>
                </div>

                <label>
                  Currency
                  <select
                    value={settings.currency}
                    onChange={(e) => handleChange("currency", e.target.value)}
                  >
                    <option value="LKR">LKR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="AUD">AUD</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="report-panel">
              <h3>Receipt Settings</h3>
              <div className="settings-form">
                <label>
                  Receipt store name
                  <input
                    type="text"
                    value={settings.storeName}
                    readOnly
                  />
                </label>

                <label>
                  Receipt address
                  <textarea
                    rows="3"
                    value={settings.storeAddress}
                    onChange={(e) => handleChange("storeAddress", e.target.value)}
                  />
                </label>

                <label>
                  Receipt phone
                  <input
                    type="text"
                    value={settings.storePhone}
                    onChange={(e) => handleChange("storePhone", e.target.value)}
                  />
                </label>

                <div className="check-grid">
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(settings.receiptShowStoreInfo)}
                      onChange={(e) => handleChange("receiptShowStoreInfo", e.target.checked)}
                    />
                    Show store information on receipt
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(settings.receiptShowDateTime)}
                      onChange={(e) => handleChange("receiptShowDateTime", e.target.checked)}
                    />
                    Show date/time
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(settings.receiptShowCashier)}
                      onChange={(e) => handleChange("receiptShowCashier", e.target.checked)}
                    />
                    Show cashier information
                  </label>
                </div>

                <label>
                  Receipt footer/message
                  <textarea
                    rows="3"
                    value={settings.receiptFooter}
                    onChange={(e) => handleChange("receiptFooter", e.target.value)}
                  />
                </label>
              </div>
            </section>

            <section className="report-panel">
              <h3>Tax Settings</h3>
              <div className="settings-form">
                <label className="checkbox-inline">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.taxEnabled)}
                    onChange={(e) => handleChange("taxEnabled", e.target.checked)}
                  />
                  Enable tax
                </label>

                <label>
                  Tax percentage
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={settings.taxRate}
                    onChange={(e) => handleChange("taxRate", e.target.value)}
                  />
                </label>
              </div>
            </section>

            <section className="report-panel">
              <h3>POS Settings</h3>
              <div className="settings-form">
                <label>
                  Default payment method
                  <select
                    value={settings.defaultPaymentMethod}
                    onChange={(e) => handleChange("defaultPaymentMethod", e.target.value)}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Other">Other</option>
                  </select>
                </label>

                <label className="checkbox-inline">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.allowNegativeStock)}
                    onChange={(e) => handleChange("allowNegativeStock", e.target.checked)}
                  />
                  Allow negative stock
                </label>

                <label>
                  Low-stock threshold
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={settings.lowStockThreshold}
                    onChange={(e) => handleChange("lowStockThreshold", e.target.value)}
                  />
                </label>
              </div>
            </section>

            <section className="report-panel">
              <h3>Appearance</h3>
              <div className="settings-form">
                <label className="checkbox-inline">
                  <input type="checkbox" checked readOnly />
                  Comfortable layout (current POS style)
                </label>
                <p className="muted-note">
                  This installation keeps the existing POS layout and does not introduce a separate theme system.
                </p>
              </div>
            </section>
          </div>

          <div className="settings-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default Settings;
