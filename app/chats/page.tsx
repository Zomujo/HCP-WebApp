import { chatThreads, patientDetail } from '../lib/dummy';
import { Sidebar } from '../components/Sidebar';

export default function ChatsPage() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content">
        <div className="app-header">
          <div>
            <h1 className="page-title">Chats</h1>
            <p className="subtitle">Reply in plain language and keep the care conversation moving.</p>
          </div>
        </div>

        <div className="patient-grid">
          <div className="panel" style={{ padding: 26 }}>
            <div className="search-row" style={{ marginBottom: 22 }}>
              <input type="text" placeholder="Search patients" />
              <button className="ghost small">Filter</button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {chatThreads.map((thread) => (
                <div key={thread.id} style={{ padding: 18, borderRadius: 18, background: '#f8fafc' }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>{thread.name}</p>
                  <p className="text-muted" style={{ margin: '8px 0 0' }}>{thread.latest}</p>
                  <p className="text-muted" style={{ margin: '8px 0 0' }}>{thread.time}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel" style={{ padding: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22 }}>
              <div className="avatar-badge" style={{ width: 64, height: 64, fontSize: '1.15rem' }}>{patientDetail.initials}</div>
              <div>
                <p style={{ margin: 0, fontWeight: 700 }}>{patientDetail.name}</p>
                <p className="text-muted" style={{ margin: '6px 0 0' }}>{patientDetail.age} • {patientDetail.condition} • Patient since {patientDetail.joined}</p>
              </div>
            </div>

            <div className="message-list">
              {patientDetail.messages.map((message, index) => (
                <div key={index} className={`message-bubble ${message.type === 'to' ? 'message-to' : 'message-from'}`}>
                  {message.text}
                  <div className="message-time">{message.time}</div>
                </div>
              ))}
            </div>

            <div className="chat-input-row">
              <input type="text" placeholder="Write a short, warm reply..." />
              <button className="primary small">➤</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
