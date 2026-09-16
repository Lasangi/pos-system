# POS System

## Overview
This project is a Point of Sale (POS) system built for managing sales, inventory, customers, reports, and store settings in a simple but professional workflow.

The application uses:

- React
- Vite
- Express.js
- Node.js
- MySQL

The frontend provides a responsive sales interface, while the backend handles business logic, stock validation, sales persistence, reports, and settings.

## Features

- Dashboard
- POS / Checkout
- Products
- Inventory management
- Sales history
- Customers management
- Reports
- Settings
- Receipt printing

## Technology Stack

### Frontend
- React
- Vite
- JavaScript / JSX
- CSS

### Backend
- Node.js
- Express
- MySQL
- mysql2
- CORS
- dotenv

### Database
- MySQL

## Project Structure

```text
pos-system/
├── backend/
│   ├── .env.example (optional local template)
│   ├── package.json
│   ├── server.js
│   └── node_modules/ (ignored by Git)
├── frontend/
│   ├── public/
│   ├── src/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── node_modules/ (ignored by Git)
├── .gitignore
├── README.md
└── scripts/
```

### Important files
- backend/server.js: backend API and database initialization
- frontend/src/App.jsx: app-level navigation and screen switching
- frontend/src/POS.jsx: checkout and cart flow
- frontend/src/components/Dashboard.jsx: analytics overview
- frontend/src/components/Reports.jsx: sales and inventory reporting
- frontend/src/components/Settings.jsx: POS defaults and configuration

## Requirements
Before running the project, make sure you have:

- Node.js
- npm
- MySQL server (for example XAMPP, WAMP, or a local MySQL installation)
- Git

## Installation

### 1. Clone repository
```bash
git clone YOUR_REPOSITORY_URL
cd pos-system
```

### 2. Install frontend dependencies
```bash
cd frontend
npm install
```

### 3. Install backend dependencies
```bash
cd ../backend
npm install
```

### 4. Configure environment
Create a file named `backend/.env` and add your local database settings, for example:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=pos_system
DB_PORT=3306
```

Do not commit real credentials or production secrets.

### 5. Start backend
```bash
cd backend
node server.js
```

### 6. Start frontend
Open a second terminal and run:

```bash
cd frontend
npm run dev
```

The frontend typically runs at:
- http://localhost:5173

The backend typically runs at:
- http://localhost:5000

## Database
The application expects a MySQL database named `pos_system`.

The server initializes required tables automatically if they are missing, including the core tables used for:

- products
- sales
- sale_items
- customers
- settings

Manual database creation is usually not required if the MySQL server is available and the connection details in the `.env` file are correct.

## API
The application exposes the following main backend routes.

### Products
- GET /api/products
- POST /api/products

### Customers
- GET /api/customers
- GET /api/customers/:id
- POST /api/customers
- PUT /api/customers/:id
- DELETE /api/customers/:id

### Inventory
- GET /api/inventory
- PUT /api/inventory/:id

### Sales
- GET /api/sales
- GET /api/sales/:id
- POST /api/checkout

### Settings
- GET /api/settings
- PUT /api/settings

### Reports
- GET /api/reports/summary
- GET /api/reports/sales
- GET /api/reports/payment-methods
- GET /api/reports/top-products
- GET /api/reports/inventory

### Dashboard
- GET /api/dashboard

## Authentication and Access
The application uses a session-based login flow with role-based access. Users authenticate through the backend before they can access the main POS workflow.

- Admin users can access the full application, including User Management.
- Cashier users can access standard POS functions but are blocked from admin-only APIs.
- Inactive accounts cannot sign in.
- Passwords are hashed on the backend and are never returned to the frontend.
- Authentication state is kept in server-side sessions rather than localStorage.

## Usage
A typical workflow is:

1. Add products
2. Manage inventory levels
3. Create and complete a sale in the POS screen
4. Select payment method
5. Process checkout
6. View the receipt
7. Review sales history
8. Manage customers
9. Review reports
10. Update store settings
11. Monitor dashboard metrics

## Testing
The project was validated with:

```bash
cd backend
node --check server.js

cd ../frontend
npm run build
```

These checks were used to confirm the backend syntax and the frontend production build remain valid.

## Backup
A database backup was created before the final demo-data cleanup review. This backup was kept outside of the Git repository to avoid committing sensitive data or local environment records.

## Known Data
The current database contains some historical records that may include names such as "Test Product" and "john". These entries were intentionally preserved in the final audit because they are connected to existing sales history and should not be deleted without clear evidence that they are temporary or invalid.

## Future Improvements
The following are possible future enhancements and are not part of the current submission:

- authentication and user roles
- barcode scanner integration
- supplier management
- advanced analytics
- cloud deployment
- role-based permissions

## License
This project is provided as a local application for educational and demonstration use unless otherwise specified by the repository owner.
