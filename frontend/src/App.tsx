import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { DropZone } from './components/DropZone';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { WelcomeModal } from './components/WelcomeModal';
import './index.css';
import './App.css';

import TagManager from './components/TagManager';
import { Heap } from './components/Heap';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import { ProfilePill } from './components/ProfilePill';
import { UploadStatus } from './components/UploadStatus';
import { useItems } from './hooks/useItems';


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

import { Notebooks } from './components/Notebooks';

import { TaskManagerModal } from './components/TaskManager/TaskManagerModal';
import { Activity } from 'lucide-react';

// Main App Layout (Authenticated)
function MainApp() {
  const { items, fetchItems, deleteItemAction } = useItems();
  const [activeView, setActiveView] = useState<'heap' | 'tags' | 'notebooks'>('heap');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isTaskManagerOpen, setIsTaskManagerOpen] = useState(false);
  const location = useLocation();
  
  // Shared state for pinned items
  const [pinnedItems, setPinnedItems] = useState<Set<string>>(new Set());



  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    // If navigating with specific state, switch to that view
    if (location.state && (location.state as any).view) {
        setActiveView((location.state as any).view);
    }
  }, [location]);

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
      <TaskManagerModal 
        isOpen={isTaskManagerOpen} 
        onClose={() => setIsTaskManagerOpen(false)} 
        onOpenFile={(itemId) => {
            setSelectedItemId(itemId);
            setActiveView('heap');
            setIsTaskManagerOpen(false);
        }}
      />


      <div className="header-controls">
        <button 
            className="btn btn-ghost btn-icon" 
            onClick={() => setIsTaskManagerOpen(true)}
            title="Task Manager"
            style={{ marginRight: '0.5rem' }}
        >
            <Activity size={20} />
        </button>
        <ThemeSwitcher />
        <ProfilePill />
      </div>
      <UploadStatus />

      {/* Header Drop Zone */}
      <DropZone onUploadComplete={fetchItems} />

      <div className="nav-tabs">
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
          className={`nav-link ${activeView === 'notebooks' ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            setActiveView('notebooks');
          }}
        >
          Notebooks
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

      <div style={{ display: activeView === 'heap' ? 'block' : 'none' }}>
        <Heap 
            isActive={activeView === 'heap'} 
            pinnedItems={pinnedItems}
            setPinnedItems={setPinnedItems}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
        />
      </div>

      <div style={{ display: activeView === 'notebooks' ? 'block' : 'none', height: '100%' }}>
         <Notebooks 
            isActive={activeView === 'notebooks'} 
            pinnedItems={pinnedItems}
         />
      </div>

      <div style={{ display: activeView === 'tags' ? 'block' : 'none' }}>
        <TagManager isActive={activeView === 'tags'} />
      </div>
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
