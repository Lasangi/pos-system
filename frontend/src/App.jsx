import { useEffect, useState } from "react";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import Products from "./components/Products";
import POS from "./POS";
import Sales from "./components/Sales";
import Inventory from "./components/Inventory";
import Customers from "./components/Customers";
import Reports from "./components/Reports";
import Settings from "./components/Settings";
import UserManagement from "./components/UserManagement";
import Login from "./components/Login";

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [user, setUser] = useState(null);
  const [setupStatus, setSetupStatus] = useState({ hasUsers: false, requireFirstAdmin: true });
  const [authLoading, setAuthLoading] = useState(true);

  async function checkSetupStatus() {
    try {
      const response = await fetch("http://localhost:5000/api/auth/setup-status", { credentials: "include" });
      const data = await response.json().catch(() => ({}));
      setSetupStatus({
        hasUsers: Boolean(data?.hasUsers),
        requireFirstAdmin: Boolean(data?.requireFirstAdmin),
      });
      return Boolean(data?.requireFirstAdmin);
    } catch (error) {
      setSetupStatus({ hasUsers: false, requireFirstAdmin: true });
      return true;
    }
  }

  async function loadSession() {
    setAuthLoading(true);
    try {
      const response = await fetch("http://localhost:5000/api/auth/session", { credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.authenticated && data?.user) {
        setUser(data.user);
        return;
      }

      const requiresInitialUser = await checkSetupStatus();
      if (requiresInitialUser) {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    loadSession();
  }, []);

  async function handleAuthenticated(nextUser) {
    setUser(nextUser);
    setCurrentPage("dashboard");
    await checkSetupStatus();
  }

  async function handleLogout() {
    try {
      await fetch("http://localhost:5000/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      // ignore logout failure; continue closing session locally
    }
    setUser(null);
    setCurrentPage("dashboard");
  }

  if (authLoading) {
    return <div className="auth-shell"><div className="auth-card"><p>Loading POS system...</p></div></div>;
  }

  if (!user) {
    return (
      <Login
        setupStatus={setupStatus}
        onAuthenticated={handleAuthenticated}
        onRequireSetupReset={() => checkSetupStatus()}
      />
    );
  }

  return (
    <div className="app">
      <Header user={user} onLogout={handleLogout} />

      <div className="layout">
        <Sidebar
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          user={user}
        />

        <main className="main-content">
          {currentPage === "dashboard" && <Dashboard setCurrentPage={setCurrentPage} />}
          {currentPage === "products" && <Products />}
          {currentPage === "pos" && <POS user={user} />}
          {currentPage === "sales" && <Sales />}
          {currentPage === "inventory" && <Inventory />}
          {currentPage === "customers" && <Customers />}
          {currentPage === "reports" && <Reports />}
          {currentPage === "settings" && <Settings user={user} />}
          {currentPage === "users" && <UserManagement user={user} />}
        </main>
      </div>
    </div>
  );
}

export default App;