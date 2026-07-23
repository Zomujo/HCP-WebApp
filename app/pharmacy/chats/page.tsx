"use client";

import { useEffect, useState } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { chatApi } from '../../lib/api';

interface ChatSession {
  id: string;
  name: string;
  latest: string;
  time: string;
}

export default function PharmacyChatsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedThread, setSelectedThread] = useState<ChatSession | null>(null);
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
          setSelectedThread(sessions[0]);
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

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedThread) return;

    setIsSending(true);
    try {
      // This would typically call an API endpoint to send the message
      // For now, just clear the message
      setMessageText('');
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ProtectedRoute requiredRole="pharmacy">
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <div className="hcp-page-header">
            <div>
              <h1 className="hcp-page-title">Messages</h1>
              <p className="subtitle">Communicate with health workers and patients.</p>
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
            <section className="pharmacy-chat-layout">
              <div className="panel hcp-panel pharmacy-chat-list-panel">
                <p className="panel-title pharmacy-chat-list-title">Conversations</p>
                {chatSessions.length > 0 ? (
                  chatSessions.map((thread) => (
                    <div
                      key={thread.id}
                      onClick={() => setSelectedThread(thread)}
                      className={`pharmacy-chat-thread-item ${selectedThread?.id === thread.id ? 'active' : ''}`}
                      style={{ cursor: 'pointer' }}
                    >
                      <p className="pharmacy-chat-thread-name">{thread.name}</p>
                      <p className="pharmacy-chat-thread-preview">
                        {thread.latest}
                      </p>
                      <p className="pharmacy-chat-thread-time">{thread.time}</p>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                    No conversations
                  </div>
                )}
              </div>

              <div className="panel hcp-panel pharmacy-chat-main-panel">
                {selectedThread ? (
                  <>
                    <div className="pharmacy-chat-main-header">
                      <p className="panel-title pharmacy-chat-main-title">{selectedThread.name}</p>
                    </div>

                    <div className="pharmacy-chat-main-messages">
                      <div className="pharmacy-chat-bubble from">
                        <p className="pharmacy-chat-bubble-author">{selectedThread.name}</p>
                        <p className="pharmacy-chat-bubble-text">{selectedThread.latest}</p>
                      </div>
                      <div className="pharmacy-chat-bubble to">
                        <p className="pharmacy-chat-bubble-author you">You</p>
                        <p className="pharmacy-chat-bubble-text">Thank you for reaching out.</p>
                      </div>
                    </div>

                    <div className="pharmacy-chat-input-row">
                      <input 
                        type="text" 
                        placeholder="Type your message..."
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
                    Select a conversation to start messaging
                  </div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
