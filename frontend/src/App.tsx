import { useEffect, useState } from 'react';
import { DropZone } from './components/DropZone';
import { FileCard } from './components/FileCard';
import { ThemeSwitcher } from './components/ThemeSwitcher';
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
    const interval = setInterval(fetchItems, 2000); // Poll every 2s for updates
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container">
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
