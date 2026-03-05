import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { FleetDashboard } from './components/FleetDashboard';
import { AppDetailWorkspace } from './components/AppDetailWorkspace';
import { GeppyChat } from './components/GeppyChat';

const AppContent = () => {
  const location = useLocation();
  const isDashboard = location.pathname === '/';

  return (
    <div className={`min-h-screen font-sans flex flex-col ${isDashboard ? 'bg-slate-50 text-geppy-darkBlue' : 'bg-slate-50 text-geppy-darkBlue'}`}>
      {!isDashboard && <Header />}
      <main className="flex-1 flex flex-col min-h-0">
        <Routes>
          <Route path="/" element={<FleetDashboard />} />
          <Route path="/app/:id" element={<AppDetailWorkspace />} />
        </Routes>
      </main>
      <GeppyChat />
    </div>
  );
};

import { TailwindProvider } from './contexts/TailwindContext';

export default function App() {
  return (
    <Router>
      <TailwindProvider>
        <AppContent />
      </TailwindProvider>
    </Router>
  );
}
