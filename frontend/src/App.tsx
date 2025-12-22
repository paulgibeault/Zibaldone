import { useEffect, useState } from 'react';
import { DropZone } from './components/DropZone';
import { FileCard } from './components/FileCard';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { WelcomeModal } from './components/WelcomeModal';
import { getItems, deleteItem, type ContentItem } from './api';
import './index.css';

function App() {
  const [items, setItems] = useState<ContentItem[]>([]);

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
      setItems(prev => prev.filter(item => item.id !== id));
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
      // Optional: Retry logic is built-in to EventSource usually, but if closed explicitly we might need to reopen.
      // For now, let's just log.
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div className="container">
      <WelcomeModal />
      <ThemeSwitcher />
      <h1>Zibaldone</h1>

      <DropZone onUploadComplete={fetchItems} />

      <div className="item-list">
        {items.map((item) => (
          <FileCard
            key={item.id}
            item={item}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
