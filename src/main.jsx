import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { initFirebase } from './firebase'
import PreLoader from './components/PreLoader'

const root = createRoot(document.getElementById('root'));

// Show loading while fetching Firebase config from backend
root.render(
  <PreLoader message="Connecting to Private Server..." />
);

initFirebase()
  .then(() => {
    root.render(
      <StrictMode>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </StrictMode>
    );
  })
  .catch((err) => {
    console.error('Firebase init failed:', err);
    root.render(
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', flexDirection: 'column', gap: '12px' }}>
        <h2 style={{ color: '#DC2626' }}>⚠️ Server Connection Error</h2>
        <p style={{ color: '#6B7280', maxWidth: '400px', textAlign: 'center' }}>
          Cannot connect to the backend server. Please ensure the backend is running on <code>http://localhost:3000</code> and has all Firebase config variables set in its <code>.env</code> file.
        </p>
        <p style={{ color: '#9CA3AF', fontSize: '13px' }}>{err.message}</p>
        <button onClick={() => window.location.reload()} style={{ padding: '8px 20px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  });
