import { useEffect, useState } from 'react';
import { DropZone } from './components/DropZone';
import { getItems, type ContentItem } from './api';
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

  useEffect(() => {
    fetchItems();
    const interval = setInterval(fetchItems, 2000); // Poll every 2s for updates
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container">
      <h1>Zibaldone</h1>

      <DropZone onUploadComplete={fetchItems} />

      <div className="item-list">
        {items.map((item) => (
          <div key={item.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }} title={item.original_filename}>
                {item.original_filename}
              </h3>
              <span className={`status-badge status-${item.status}`}>
                {item.status}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>
              {new Date(item.created_at).toLocaleString()}
            </div>
            {item.metadata_json && item.metadata_json !== "{}" && (
              <div className="metadata-preview">
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                  {JSON.stringify(JSON.parse(item.metadata_json), null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
