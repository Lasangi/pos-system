import { useState } from "react";

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

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");

  return (
    <div className="app">
      <Header />

      <div className="layout">

        <Sidebar
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
        />

        <main className="main-content">

          {currentPage === "dashboard" && <Dashboard setCurrentPage={setCurrentPage} />}

          {currentPage === "products" && <Products />}

          {currentPage === "pos" && <POS />}

          {currentPage === "sales" && <Sales />}

          {currentPage === "inventory" && <Inventory />}

          {currentPage === "customers" && <Customers />}

          {currentPage === "reports" && <Reports />}

          {currentPage === "settings" && <Settings />}

        </main>

      </div>
    </div>
  );
}

export default App;