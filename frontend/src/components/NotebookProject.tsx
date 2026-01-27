import React, { useState, useRef, useEffect } from 'react';
import { ContentItem, ChatMessage } from '../api/types';
import { chatNotebook } from '../api/endpoints/notebooks';
import { FileCard } from './FileCard';
import { Send, Bot, Check, LayoutPanelLeft, Loader2 } from 'lucide-react';
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

      setMessages(prev => [...prev, { role: 'assistant', content: response.response }]);
    } catch (error) {
      console.error("Chat Failed:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Error: Failed to get response." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="notebook-project-container" style={{ 
        display: 'flex', 
        height: 'calc(100vh - 200px)', // adjust based on header
        gap: '1rem',
        padding: '1rem',
        overflow: 'hidden'
    }}>
      
      {/* Left Panel: Library */}
      <div className="project-sidebar" style={{ 
          width: '320px', 
          display: 'flex', 
          flexDirection: 'column',
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden'
      }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LayoutPanelLeft size={18} />
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Notebook Resources</h3>
        </div>
        <div className="resource-list" style={{ overflowY: 'auto', flex: 1, padding: '0.5rem' }}>
            {items.map(item => (
                <div 
                    key={item.id} 
                    onClick={() => toggleSelection(item.id)}
                    style={{ 
                        marginBottom: '0.5rem', 
                        cursor: 'pointer',
                        border: selectedItemIds.has(item.id) ? '2px solid var(--primary)' : '2px solid transparent',
                        borderRadius: '8px',
                        position: 'relative'
                    }}
                >
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
                    {selectedItemIds.has(item.id) && (
                        <div style={{ 
                            position: 'absolute', 
                            top: '-5px', 
                            right: '-5px', 
                            background: 'var(--primary)', 
                            color: 'white', 
                            borderRadius: '50%', 
                            padding: '2px' 
                        }}>
                            <Check size={12} />
                        </div>
                    )}
                </div>
            ))}
            {items.length === 0 && <div style={{ padding: '1rem', color: 'var(--text-subtle)' }}>No items in notebook.</div>}
        </div>
      </div>

      {/* Right Panel: Workspace */}
      <div className="project-workspace" style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden'
      }}>
          
          {/* Active Context Header */}
          <div className="workspace-header" style={{ padding: '1rem', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}>
             <div style={{ fontSize: '0.85rem', color: 'var(--text-subtle)', marginBottom: '0.5rem' }}>
                 ACTIVE CONTEXT ({selectedItemIds.size})
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
          <div className="chat-area" style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {messages.length === 0 && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-subtle)' }}>
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
          <div className="input-area" style={{ padding: '1rem', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                      style={{ 
                          flex: 1, 
                          padding: '0.8rem', 
                          borderRadius: '8px', 
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          resize: 'none',
                          minHeight: '44px',
                          maxHeight: '150px'
                      }}
                  />
                  <button 
                      onClick={handleSend}
                      disabled={loading || (!input.trim() && selectedItemIds.size === 0)}
                      style={{ 
                          background: 'var(--primary)', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '8px', 
                          padding: '0 1.5rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                      }}
                  >
                      <Send size={18} />
                  </button>
              </div>
          </div>

      </div>
    </div>
  );
};
