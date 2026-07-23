"use client";

import { useEffect, useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { chatApi } from '../lib/api';

interface ChatSession {
  id: string;
  name: string;
  latest: string;
  time: string;
}

interface Message {
  id?: string;
  type: 'to' | 'from';
  text: string;
  time: string;
}

export default function ChatsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Load chat sessions on mount
  useEffect(() => {
    const loadSessions = async () => {
      try {
        setIsLoading(true);
        setError('');

        const sessions = await chatApi.getHcpSessions();
        setChatSessions(sessions);

        // Select first session by default
        if (sessions.length > 0) {
          setSelectedSession(sessions[0]);
          // Load messages for first session
          const sessionMessages = await chatApi.getMessages(sessions[0].id);
          setMessages(sessionMessages);
        }
      } catch (err) {
        console.error('Failed to load chats:', err);
        setError('Failed to load chats');
      } finally {
        setIsLoading(false);
      }
    };

    loadSessions();
  }, []);

  // Load messages when session changes
  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedSession) return;

      try {
        const sessionMessages = await chatApi.getMessages(selectedSession.id);
        setMessages(sessionMessages);
      } catch (err) {
        console.error('Failed to load messages:', err);
        setError('Failed to load messages');
      }
    };

    loadMessages();
  }, [selectedSession]);

  const filteredSessions = chatSessions.filter((session) => {
    const query = searchQuery.toLowerCase();
    return session.name.toLowerCase().includes(query);
  });

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedSession) return;

    setIsSending(true);
    try {
      // This would typically call an API endpoint to send the message
      // For now, just add it to the local state
      const newMessage: Message = {
        type: 'to',
        text: messageText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages([...messages, newMessage]);
      setMessageText('');
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const getInitials = (name: string) => {
    const normalized = (name || '').trim();
    if (!normalized) return 'U';
    return normalized.split(' ').map((p) => p[0]).join('').toUpperCase();
  };
  return (
    <ProtectedRoute requiredRole="health-worker">
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <div className="hcp-page-header">
            <div>
              <h1 className="hcp-page-title">Patient messages</h1>
              <p className="subtitle">Reply in plain language and keep the care conversation moving.</p>
            </div>
          </div>

          {error && (
            <div style={{ 
              padding: '12px', 
              backgroundColor: '#fee', 
              borderRadius: '6px',
              border: '1px solid #fcc',
              color: '#c33',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
              Loading chats...
            </div>
          ) : (
            <div className="panel hcp-panel chat-layout-figma">
              <section className="chat-thread-column">
                <div className="search-row" style={{ marginBottom: 12 }}>
                  <input 
                    type="text" 
                    placeholder="Search patients"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="chat-thread-list">
                  {filteredSessions.length > 0 ? (
                    filteredSessions.map((thread) => (
                      <div 
                        key={thread.id} 
                        className={`chat-thread-item ${selectedSession?.id === thread.id ? 'active' : ''}`}
                        onClick={() => setSelectedSession(thread)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="table-avatar">{getInitials(thread.name)}</div>
                        <div style={{ minWidth: 0 }}>
                          <p className="chat-thread-name">{thread.name}</p>
                          <p className="chat-thread-preview">{thread.latest}</p>
                        </div>
                        <span className="chat-thread-time">{thread.time}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                      No chats found
                    </div>
                  )}
                </div>
              </section>

              <section className="chat-main-column">
                {selectedSession ? (
                  <>
                    <div className="chat-main-header">
                      <div className="table-avatar">{getInitials(selectedSession.name)}</div>
                      <div>
                        <p className="chat-thread-name">{selectedSession.name}</p>
                        <p className="text-muted" style={{ margin: '2px 0 0' }}>Patient</p>
                      </div>
                    </div>

                    <div className="chat-canvas">
                      {messages.length > 0 ? (
                        messages.map((message, index) => (
                          <div key={message.id || `${message.time}-${index}`} className={`message-bubble ${message.type === 'to' ? 'message-to' : 'message-from'}`}>
                            {message.text}
                            <div className="message-time">{message.time}</div>
                          </div>
                        ))
                      ) : (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
                          No messages yet. Start a conversation!
                        </div>
                      )}
                    </div>

                    <div className="chat-suggest-row">
                      <span className="filter-pill">Thank you for the reading.</span>
                      <span className="filter-pill">Drink water.</span>
                      <span className="filter-pill">Come to the clinic tomorrow morning.</span>
                    </div>

                    <div className="chat-input-row">
                      <input 
                        type="text" 
                        placeholder="Write a short, warm reply..."
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        disabled={isSending}
                      />
                      <button 
                        className="primary small"
                        onClick={handleSendMessage}
                        disabled={isSending || !messageText.trim()}
                      >
                        {isSending ? '...' : 'Send'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
                    Select a patient to view messages
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
