import { useState,useEffect } from "react";

function Products() {
 const [products, setProducts] = useState([]);

const [name, setName] = useState("");
const [price, setPrice] = useState("");
const [stock, setStock] = useState("");

useEffect(() => {
  fetch("http://localhost:5000/api/products")
    .then((response) => response.json())
    .then((data) => {
      setProducts(data);
    });
}, []);

async function addProduct() {
  const newProduct = {
    name: name,
    price: Number(price),
    stock: Number(stock)
  };

  const response = await fetch("http://localhost:5000/api/products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(newProduct)
  });

  const data = await response.json();

  setProducts([...products, data]);

  setName("");
  setPrice("");
  setStock("");
}

  return (
    <div className="products">
      <h2>Products</h2>

      <div className="product-form">
  <input
  type="text"
  placeholder="Product name"
  value={name}
  onChange={(e) => setName(e.target.value)}
/>

  <input
  type="number"
  placeholder="Price"
  value={price}
  onChange={(e) => setPrice(e.target.value)}
/>

  <input
  type="number"
  placeholder="Stock"
  value={stock}
  onChange={(e) => setStock(e.target.value)}
/>

  <button onClick={addProduct}>Add Product</button>
</div>

      <div className="product-list">
        {products.map((product) => (
          <div className="product-card" key={product.name}>
            <h3>{product.name}</h3>
            <p>Price: Rs. {product.price}</p>
            <p>Stock: {product.stock}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Products;