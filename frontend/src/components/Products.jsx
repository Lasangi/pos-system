import { useState, useEffect } from "react";

function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");

  useEffect(() => {
    fetch("http://localhost:5000/api/products")
      .then((response) => response.json())
      .then((data) => {
        setProducts(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setProducts([]);
        setError("Failed to load products.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function addProduct() {
    const trimmedName = name.trim();
    const parsedPrice = Number(price);
    const parsedStock = Number(stock);

    if (!trimmedName) {
      setError("Product name is required.");
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError("Please enter a valid price.");
      return;
    }

    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      setError("Please enter a valid stock value.");
      return;
    }

    setSubmitting(true);
    setError("");

    const newProduct = {
      name: trimmedName,
      price: parsedPrice,
      stock: parsedStock,
    };

    try {
      const response = await fetch("http://localhost:5000/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newProduct),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to add product");
      }

      setProducts((currentProducts) => [...currentProducts, data]);
      setName("");
      setPrice("");
      setStock("");
    } catch (addError) {
      setError(addError.message || "Failed to add product.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="products">
      <div className="page-header">
        <h2>Products</h2>
      </div>

      <div className="product-form">
        <input
          type="text"
          placeholder="Product name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />

        <input
          type="number"
          min="0"
          step="1"
          placeholder="Stock"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />

        <button type="button" onClick={addProduct} disabled={submitting}>
          {submitting ? "Adding..." : "Add Product"}
        </button>
      </div>

      {error && <div className="field-error product-error">{error}</div>}

      {loading ? (
        <div className="empty-state">Loading products...</div>
      ) : products.length === 0 ? (
        <div className="empty-state">No products found.</div>
      ) : (
        <div className="product-list">
          {products.map((product) => (
            <div className="product-card" key={product.id ?? product.name}>
              <h3>{product.name}</h3>
              <p>Price: Rs. {Number(product.price).toFixed(2)}</p>
              <p>Stock: {product.stock}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Products;