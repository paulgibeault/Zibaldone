import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { DropZone } from './components/DropZone';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { WelcomeModal } from './components/WelcomeModal';
import './index.css';
import './App.css';

import TagManager from './components/TagManager';
import { Explore } from './components/Explore';
import { Heap } from './components/Heap';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import { ProfilePill } from './components/ProfilePill';
import { UploadStatus } from './components/UploadStatus';
import { useItems } from './hooks/useItems';
import { useEventSubscription } from './hooks/useEventSubscription';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.JSX.Element }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// Main App Layout (Authenticated)
function MainApp() {
  const { items, fetchItems, deleteItemAction } = useItems();
  const [activeView, setActiveView] = useState<'heap' | 'tags' | 'explore'>('heap');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
  useEventSubscription(`${API_URL}/events`, fetchItems);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this item?")) return;

    try {
      await deleteItemAction(id);
    } catch (error) {
      alert("Failed to delete item");
    }
  };

  return (
    <div className="container">
      <WelcomeModal />


      <div className="header-controls">
        <ThemeSwitcher />
        <ProfilePill />
      </div>
      <UploadStatus />

      {/* Header Drop Zone */}
      <DropZone onUploadComplete={fetchItems} />

      <div className="nav-tabs">
        <button
          type="button"
          className={`nav-link ${activeView === 'explore' ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            setActiveView('explore');
          }}
        >
          Explore
        </button>
        <button
          type="button"
          className={`nav-link ${activeView === 'heap' ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            setActiveView('heap');
          }}
        >
          The Heap
        </button>
        <button
          type="button"
          className={`nav-link ${activeView === 'tags' ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            setActiveView('tags');
          }}
        >
          Index
        </button>
      </div>

      {activeView === 'heap' && (
        <Heap
          items={items}
          onDelete={handleDelete}
          onRefresh={fetchItems}
          selectedItemId={selectedItemId}
          onSelect={(id) => setSelectedItemId(id)}
          onDeselect={() => setSelectedItemId(null)}
        />
      )}

      {activeView === 'tags' && <TagManager />}

      {activeView === 'explore' && <Explore />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainApp />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
