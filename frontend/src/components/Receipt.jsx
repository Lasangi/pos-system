import React, { useEffect, useState } from 'react';

const DEFAULT_SETTINGS = {
  storeName: 'My POS Store',
  storeAddress: '',
  storePhone: '',
  storeEmail: '',
  currency: 'LKR',
  receiptShowStoreInfo: true,
  receiptShowDateTime: true,
  receiptShowCashier: false,
  receiptFooter: 'Thank you for your purchase!'
};

function formatDateTime(iso) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function formatCurrency(value, currency = 'LKR') {
  const amount = Number(value || 0);
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${formatter.format(amount)}`;
}

export default function Receipt({ sale }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    fetch('http://localhost:5000/api/settings')
      .then((res) => res.json())
      .then((data) => setSettings({ ...DEFAULT_SETTINGS, ...data }))
      .catch(() => setSettings(DEFAULT_SETTINGS));
  }, []);

  if (!sale) return null;

  const customerName = sale.customer_name || 'Walk-in Customer';
  const hasFooter = Boolean(settings.receiptFooter && String(settings.receiptFooter).trim());

  return (
    <div className="receipt" style={{ fontFamily: 'monospace', maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>--------------------------------</div>
      <h3 style={{ textAlign: 'center', margin: '6px 0' }}>{settings.storeName || 'MY POS SYSTEM'}</h3>
      {settings.receiptShowStoreInfo && (
        <>
          {settings.storeAddress && <div style={{ textAlign: 'center' }}>{settings.storeAddress}</div>}
          {settings.storePhone && <div style={{ textAlign: 'center' }}>{settings.storePhone}</div>}
          {settings.storeEmail && <div style={{ textAlign: 'center' }}>{settings.storeEmail}</div>}
          <div style={{ textAlign: 'center', marginBottom: 8 }}>--------------------------------</div>
        </>
      )}

      <div>Receipt No: #{sale.id}</div>
      {settings.receiptShowDateTime && <div>Date: {formatDateTime(sale.created_at)}</div>}
      <div>Customer: {customerName}</div>
      <div>Payment: {sale.payment_method}</div>
      {settings.receiptShowCashier && sale.cashierName && <div>Cashier: {sale.cashierName}</div>}
      {typeof sale.cashReceived !== 'undefined' && (
        <>
          <div>Cash Received: {formatCurrency(sale.cashReceived, settings.currency)}</div>
          <div>Change: {formatCurrency(Number(sale.change || 0), settings.currency)}</div>
        </>
      )}

      <div style={{ margin: '12px 0' }}>--------------------------------</div>

      {typeof sale.subtotal !== 'undefined' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>Subtotal:</div>
            <div>{formatCurrency(sale.subtotal, settings.currency)}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>Discount:</div>
            <div>-{formatCurrency(Number(sale.discount || 0), settings.currency)}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>Tax ({Number(sale.tax_rate || 0)}%):</div>
            <div>{formatCurrency(Number(sale.tax_amount || 0), settings.currency)}</div>
          </div>
          <div style={{ marginTop: 8 }}>--------------------------------</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: 8 }}>
            <div>TOTAL:</div>
            <div>{formatCurrency(sale.total, settings.currency)}</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>TOTAL:</div>
          <div>{formatCurrency(sale.total, settings.currency)}</div>
        </div>
      )}

      <div style={{ margin: '12px 0' }}>--------------------------------</div>

      <div style={{ display: 'flex', fontWeight: 'bold' }}>
        <div style={{ flex: 1 }}>Product</div>
        <div style={{ width: 40, textAlign: 'right' }}>Qty</div>
        <div style={{ width: 80, textAlign: 'right' }}>Price</div>
        <div style={{ width: 90, textAlign: 'right' }}>Total</div>
      </div>

      <div>--------------------------------</div>

      {sale.items.map((it) => (
        <div key={it.product_id} style={{ display: 'flex', marginTop: 6 }}>
          <div style={{ flex: 1 }}>{it.name}</div>
          <div style={{ width: 40, textAlign: 'right' }}>{it.quantity}</div>
          <div style={{ width: 80, textAlign: 'right' }}>{formatCurrency(it.price, settings.currency)}</div>
          <div style={{ width: 90, textAlign: 'right' }}>{formatCurrency(it.subtotal, settings.currency)}</div>
        </div>
      ))}

      <div style={{ marginTop: 8 }}>--------------------------------</div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <strong>TOTAL: &nbsp; {formatCurrency(sale.total, settings.currency)}</strong>
      </div>

      <div style={{ marginTop: 12 }}>--------------------------------</div>

      {hasFooter && <div style={{ textAlign: 'center', marginTop: 10 }}>{settings.receiptFooter}</div>}
    </div>
  );
}
