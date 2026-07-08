"use client";

import { useState } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { pharmacyChatThreads } from '../../lib/dummy';

export default function PharmacyChatsPage() {
  const [selectedThread, setSelectedThread] = useState(pharmacyChatThreads[0]);

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

          <section style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '18px', marginTop: 18 }}>
            <div className="panel hcp-panel" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <p className="panel-title" style={{ marginBottom: 12 }}>Conversations</p>
              {pharmacyChatThreads.map((thread) => (
                <div
                  key={thread.id}
                  onClick={() => setSelectedThread(thread)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    backgroundColor: selectedThread.id === thread.id ? '#f0f7ff' : 'transparent',
                    borderLeft: selectedThread.id === thread.id ? '3px solid #0066cc' : 'none',
                    paddingLeft: selectedThread.id === thread.id ? '9px' : '12px',
                  }}
                >
                  <p style={{ margin: '0 0 4px 0', fontWeight: 700, fontSize: '14px' }}>{thread.name}</p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {thread.latest}
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#999' }}>{thread.time}</p>
                </div>
              ))}
            </div>

            <div className="panel hcp-panel" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ borderBottom: '1px solid #e0e0e0', paddingBottom: 12, marginBottom: 12 }}>
                <p className="panel-title" style={{ margin: 0 }}>{selectedThread.name}</p>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
                <div style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px', marginBottom: 8 }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: 700, color: '#666' }}>{selectedThread.name}</p>
                  <p style={{ margin: 0, fontSize: '14px' }}>{selectedThread.latest}</p>
                </div>
                <div style={{ padding: '12px', backgroundColor: '#e8f4f8', borderRadius: '8px', marginLeft: 'auto', maxWidth: '70%', marginBottom: 8 }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: 700, color: '#0066cc' }}>You</p>
                  <p style={{ margin: 0, fontSize: '14px' }}>Thank you for reaching out.</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Type your message..."
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
                <button className="primary" style={{ padding: '8px 16px' }}>Send</button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
