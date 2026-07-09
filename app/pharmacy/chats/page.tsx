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

          <section className="pharmacy-chat-layout">
            <div className="panel hcp-panel pharmacy-chat-list-panel">
              <p className="panel-title pharmacy-chat-list-title">Conversations</p>
              {pharmacyChatThreads.map((thread) => (
                <div
                  key={thread.id}
                  onClick={() => setSelectedThread(thread)}
                  className={`pharmacy-chat-thread-item ${selectedThread.id === thread.id ? 'active' : ''}`}
                >
                  <p className="pharmacy-chat-thread-name">{thread.name}</p>
                  <p className="pharmacy-chat-thread-preview">
                    {thread.latest}
                  </p>
                  <p className="pharmacy-chat-thread-time">{thread.time}</p>
                </div>
              ))}
            </div>

            <div className="panel hcp-panel pharmacy-chat-main-panel">
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
                <input type="text" placeholder="Type your message..." />
                <button className="primary small">Send</button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
