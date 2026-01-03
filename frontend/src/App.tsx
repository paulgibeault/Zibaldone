import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { DropZone } from './components/DropZone';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { WelcomeModal } from './components/WelcomeModal';
import { getItems, deleteItem, type ContentItem } from './api';
import './index.css';

import TagManager from './components/TagManager';
import { Explore } from './components/Explore';
import { Heap } from './components/Heap';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';

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
  const [items, setItems] = useState<ContentItem[]>([]);
  const [activeView, setActiveView] = useState<'heap' | 'tags' | 'explore'>('heap');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const { logout, user } = useAuth();

  const fetchItems = async () => {
    try {
      const data = await getItems();
      // Sort by created_at desc
      data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setItems(data);
    } catch (error) {
      console.error("Failed to fetch items:", error);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this item?")) return;

    try {
      await deleteItem(id);
      setItems((prev: ContentItem[]) => prev.filter((item: ContentItem) => item.id !== id));
    } catch (error) {
      console.error("Failed to delete item:", error);
      alert("Failed to delete item");
    }
  };

  useEffect(() => {
    fetchItems();

    // Setup SSE
    const eventSource = new EventSource('http://localhost:8000/api/events');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'update') {
          console.log("Received update event:", data);
          fetchItems();
        }
      } catch (e) {
        console.error("Error parsing SSE data", e);
      }
    };

    eventSource.onerror = (e) => {
      console.log("SSE Error (connection might be closed):", e);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div className="container">
      <WelcomeModal />
      <ThemeSwitcher />

      <div style={{ position: 'absolute', top: '1rem', right: '4rem', fontSize: '0.8rem' }}>
        Logged in as {user?.display_name} <button onClick={logout} style={{ marginLeft: '0.5rem' }}>Logout</button>
      </div>

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
