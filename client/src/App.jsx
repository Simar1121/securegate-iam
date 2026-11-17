import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AppRoutes } from './routes/AppRoutes';
import { SetupGate } from './components/SetupGate';

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <SetupGate><AppRoutes /></SetupGate>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
