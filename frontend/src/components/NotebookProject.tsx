import React, { useState, useRef, useEffect } from 'react';
import { ContentItem, ChatMessage } from '../api/types';
import { chatNotebook, addItemsToNotebook } from '../api/endpoints/notebooks';
import { uploadFile } from '../api/endpoints/items';
import { FileCard } from './FileCard';
import { Send, Bot, Check, LayoutPanelLeft, Loader2, Code2, Search, ArrowUpDown, Trash2, Save, CheckSquare, Square, XCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface NotebookProjectProps {
  items: ContentItem[];
  notebookId: string;
}

export const NotebookProject: React.FC<NotebookProjectProps> = ({ items, notebookId }) => {
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  const [filterText, setFilterText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedItemIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedItemIds(newSet);
  };

  const handleSelectAll = (filteredItems: ContentItem[]) => {
      if (selectedItemIds.size === filteredItems.length && filteredItems.length > 0) {
          setSelectedItemIds(new Set());
      } else {
          setSelectedItemIds(new Set(filteredItems.map(i => i.id)));
      }
  };

  const handleClearChat = () => {
    if (window.confirm("Are you sure you want to clear the conversation?")) {
        setMessages([]);
    }
  };

  const handleSaveConversation = async () => {
    if (messages.length === 0) return;
    
    // 1. Format content
    const dateStr = new Date().toLocaleString();
    let content = `# Chat Export - ${dateStr}\n\n`;
    messages.forEach(msg => {
        content += `### ${msg.role.toUpperCase()}\n\n${msg.content}\n\n---\n\n`;
    });

    try {
        setLoading(true);
        // 2. Create File object
        const blob = new Blob([content], { type: 'text/markdown' });
        const filename = `Chat Export ${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
        const file = new File([blob], filename, { type: 'text/markdown' });

        // 3. Upload
        const newItem = await uploadFile(file, { type: 'chat-export', notebookId });
        
        // 4. Link to Notebook
        await addItemsToNotebook(notebookId, [newItem.id]);
        
        // 5. Notify/Reset
        // Ideally trigger a refresh of items here, but that requires a prop callback or context
        // For now, we assume the parent will refresh eventually or we just cleared it.
        alert("Conversation saved to notebook resources.");
    } catch (err) {
        console.error("Failed to save conversation", err);
        alert("Failed to save conversation.");
    } finally {
        setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() && selectedItemIds.size === 0) return;
    if (loading) return;

    const userMsg: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await chatNotebook(notebookId, {
        message: userMsg.content,
        context_item_ids: Array.from(selectedItemIds),
        chat_history: messages
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response.response, debug_info: response.debug_info }]);
    } catch (error) {
      console.error("Chat Failed:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Error: Failed to get response." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="notebook-project-split-container">
      

      
      {/* Derived Items for List */}
      {(() => {
          let filtered = items.filter(item => {
              if (!filterText) return true;
              return item.original_filename.toLowerCase().includes(filterText.toLowerCase());
          });
          
          filtered.sort((a, b) => {
              if (sortBy === 'date') {
                  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              } else {
                  return a.original_filename.localeCompare(b.original_filename);
              }
          });

          return (
            /* Left Panel: Library */
            <div className="notebook-project-sidebar">
              <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <LayoutPanelLeft size={16} style={{ color: 'var(--text-subtle)' }} />
                      <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Resources</h3>
                  </div>
                  
                  {/* Search, Sort, and Bulk Select Controls */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <div className="input-with-icon" style={{ flex: 1 }}>
                          <Search size={14} className="input-icon" style={{ top: '50%', transform: 'translateY(-50%)' }} />
                          <input 
                              type="text" 
                              value={filterText}
                              onChange={(e) => setFilterText(e.target.value)}
                              placeholder="Filter..." 
                              className="input input-sm"
                              style={{ width: '100%', paddingLeft: '28px', background: 'var(--bg-canvas)' }}
                          />
                      </div>
                      <button 
                          onClick={() => {
                              const allSelected = filtered.length > 0 && filtered.every(i => selectedItemIds.has(i.id));
                              const newSet = new Set(selectedItemIds);
                              if (allSelected) {
                                  filtered.forEach(i => newSet.delete(i.id));
                              } else {
                                  filtered.forEach(i => newSet.add(i.id));
                              }
                              setSelectedItemIds(newSet);
                          }}
                          title={filtered.length > 0 && filtered.every(i => selectedItemIds.has(i.id)) ? "Deselect All" : "Select All"}
                          className="btn btn-sm btn-secondary btn-icon"
                          style={{ position: 'relative', zIndex: 20 }}
                      >
                          {filtered.length > 0 && filtered.every(i => selectedItemIds.has(i.id)) ? <CheckSquare size={14} /> : <Square size={14} />}
                      </button>
                      <button 
                          onClick={() => setSortBy(prev => prev === 'date' ? 'name' : 'date')}
                          title={`Sort by ${sortBy === 'date' ? 'Name' : 'Date'}`}
                          className="btn btn-sm btn-secondary btn-icon"
                      >
                          <ArrowUpDown size={14} />
                      </button>
                  </div>
              </div>
              <div className="resource-list" style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '0.5rem' }}>
                  {filtered.map(item => (
                      <div 
                          key={item.id} 
                          onClick={() => toggleSelection(item.id)}
                          style={{ 
                              display: 'flex',
                              alignItems: 'center', // Middle Align
                              marginBottom: '0.5rem', 
                              cursor: 'pointer',
                              border: selectedItemIds.has(item.id) ? '2px solid var(--primary)' : '2px solid transparent',
                              borderRadius: '8px',
                              position: 'relative',
                              paddingRight: '8px' // Space for checkmark
                          }}
                      >
                          <div style={{ flex: 1 }}> {/* Wrap FileCard to constrain it */}
                              <FileCard 
                                  item={item} 
                                  variant="micro" 
                                  onDelete={() => {}} 
                                  onRefresh={() => {}}
                                  isSelected={selectedItemIds.has(item.id)}
                                  onSelect={() => {}}
                                  onDeselect={() => {}} 
                                  // Disable interactions that conflict with selection
                              />
                          </div>
                          {selectedItemIds.has(item.id) && (
                              <div style={{ 
                                  position: 'absolute', 
                                  top: '50%',
                                  right: '24px',
                                  transform: 'translateY(-50%)',
                                  background: 'var(--success-color, #22c55e)', // Green
                                  color: 'white', 
                                  borderRadius: '50%', 
                                  width: '20px',
                                  height: '20px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  border: '2px solid var(--bg-secondary)', // White border to separate
                                  zIndex: 10
                              }}>
                                  <Check size={12} strokeWidth={4} />
                              </div>
                          )}
                      </div>
                  ))}
                  {filtered.length === 0 && <div style={{ padding: '1rem', color: 'var(--text-subtle)', textAlign: 'center', fontSize: '0.9rem' }}>No matching items.</div>}
              </div>
            </div>
          );
      })()}

      {/* Right Panel: Workspace */}
      <div className="notebook-project-workspace">
          
          {/* Active Context Header */}
          <div className="workspace-header" style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div style={{ fontSize: '0.85rem', color: 'var(--text-subtle)' }}>
                     ACTIVE CONTEXT ({selectedItemIds.size})
                 </div>
                 <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button 
                         onClick={handleClearChat}
                         disabled={messages.length === 0}
                         className="btn btn-ghost btn-sm btn-icon" 
                         title="Clear Conversation"
                     >
                         <Trash2 size={16} />
                     </button>
                    <button 
                         onClick={handleSaveConversation}
                         disabled={messages.length === 0}
                         className="btn btn-ghost btn-sm btn-icon" 
                         title="Save Conversation to Notebook"
                     >
                         <Save size={16} />
                     </button>
                     <button 
                         onClick={() => setShowDebug(!showDebug)}
                         className={`btn-icon ${showDebug ? 'active' : ''}`} 
                         title="Toggle Debug Mode"
                         style={{ 
                             background: 'none', 
                             border: 'none', 
                             cursor: 'pointer', 
                             color: showDebug ? 'var(--primary)' : 'var(--text-subtle)',
                             padding: '4px'
                         }}
                     >
                         <Code2 size={16} />
                     </button>
                 </div>
             </div>
             <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                 {Array.from(selectedItemIds).map(id => {
                     const item = items.find(i => i.id === id);
                     if (!item) return null;
                     return (
                         <span key={id} style={{ 
                             background: 'var(--bg-card-hover)', 
                             border: '1px solid var(--border-subtle)',
                             borderRadius: '16px',
                             padding: '2px 8px',
                             fontSize: '0.8rem',
                             display: 'flex',
                             alignItems: 'center',
                             whiteSpace: 'nowrap'
                         }}>
                             {item.original_filename}
                             <button 
                                onClick={(e) => { e.stopPropagation(); toggleSelection(id); }}
                                style={{ marginLeft: '4px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                             >
                                 &times;
                             </button>
                         </span>
                     );
                 })}
                 {selectedItemIds.size === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>Select items from the left to add context</span>}
             </div>
          </div>

          {/* Chat Area */}
          <div className="chat-area" style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
              {messages.length === 0 && (
                  <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-subtle)' }}>
                      <Bot size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                      <p>Start a conversation with your project context.</p>
                  </div>
              )}
              
              {messages.map((msg, idx) => (
                  <div key={idx} style={{ 
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      background: msg.role === 'user' ? 'var(--primary)' : 'var(--bg-subtle)',
                      color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                      padding: '1rem',
                      borderRadius: '12px',
                      borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px',
                      borderBottomLeftRadius: msg.role === 'assistant' ? '2px' : '12px'
                  }}>
                      {msg.role === 'assistant' ? (
                          <div className="markdown-content">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                          </div>
                      ) : (
                          msg.content
                      )}
                      
                      {/* Debug Info Display */}
                      {showDebug && msg.debug_info && (
                          <div style={{ 
                              marginTop: '1rem', 
                              padding: '0.5rem', 
                              background: 'rgba(0,0,0,0.2)', 
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                              overflowX: 'auto'
                          }}>
                              <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-subtle)' }}>DEBUG INFO:</div>
                              <details>
                                  <summary style={{ cursor: 'pointer', color: 'var(--text-subtle)' }}>Raw Messages Sent</summary>
                                  <pre style={{ margin: 0 }}>{JSON.stringify(msg.debug_info.raw_prompt_messages, null, 2)}</pre>
                              </details>
                              <details style={{ marginTop: '0.5rem' }}>
                                  <summary style={{ cursor: 'pointer', color: 'var(--text-subtle)' }}>Raw Response</summary>
                                  <pre style={{ margin: 0 }}>{typeof msg.debug_info.raw_response === 'string' ? msg.debug_info.raw_response : JSON.stringify(msg.debug_info.raw_response, null, 2)}</pre>
                              </details>
                          </div>
                      )}
                  </div>
              ))}
              {loading && (
                  <div style={{ alignSelf: 'flex-start', padding: '1rem', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Loader2 className="spin" size={16} /> Thinking...
                  </div>
              )}
              <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="input-area" style={{ padding: '1rem', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                  <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSend();
                          }
                      }}
                      placeholder="Ask questions or generate content based on selected files..."
                      className="input"
                      style={{ 
                          flex: 1, 
                          resize: 'none',
                          minHeight: '44px',
                          maxHeight: '150px',
                          lineHeight: '1.5'
                      }}
                  />
                  <button 
                      onClick={handleSend}
                      disabled={loading || (!input.trim() && selectedItemIds.size === 0)}
                      className="btn btn-primary btn-icon"
                      style={{ height: '44px', width: '44px' }}
                  >
                      <Send size={18} />
                  </button>
              </div>
          </div>

      </div>
    </div>
  );
};
