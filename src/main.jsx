import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import CustomerDisplay from './components/CustomerDisplay';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Opened as its own standalone window (?view=customer-display); needs no login/tenant context since it syncs purely via BroadcastChannel.
const isCustomerDisplay = new URLSearchParams(window.location.search).get('view') === 'customer-display';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary label="Selsolve POS hit an unexpected error.">
      {isCustomerDisplay ? <CustomerDisplay /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>
);
