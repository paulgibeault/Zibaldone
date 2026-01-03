import React, { useEffect, useState } from 'react';
import { DropZone } from './components/DropZone';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { WelcomeModal } from './components/WelcomeModal';
import { getItems, deleteItem, type ContentItem } from './api';
import './index.css';

import TagManager from './components/TagManager';
import { Explore } from './components/Explore';
import { Heap } from './components/Heap';

function App() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [activeView, setActiveView] = useState<'heap' | 'tags' | 'explore'>('heap');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

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

export default App;
