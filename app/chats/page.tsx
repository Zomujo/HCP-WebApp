import { chatThreads, patientDetail } from '../lib/dummy';
import { Sidebar } from '../components/Sidebar';

export default function ChatsPage() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content hcp-page">
        <div className="hcp-page-header">
          <div>
            <h1 className="hcp-page-title">Patient messages</h1>
            <p className="subtitle">Reply in plain language and keep the care conversation moving.</p>
          </div>
        </div>

        <div className="panel hcp-panel chat-layout-figma">
          <section className="chat-thread-column">
            <div className="search-row" style={{ marginBottom: 12 }}>
              <input type="text" placeholder="Search patients" />
            </div>

            <div className="chat-thread-list">
              {chatThreads.map((thread) => (
                <div key={thread.id} className="chat-thread-item">
                  <div className="table-avatar">{thread.name.split(' ').map((p) => p[0]).join('')}</div>
                  <div style={{ minWidth: 0 }}>
                    <p className="chat-thread-name">{thread.name}</p>
                    <p className="chat-thread-preview">{thread.latest}</p>
                  </div>
                  <span className="chat-thread-time">{thread.time}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="chat-main-column">
            <div className="chat-main-header">
              <div className="table-avatar">{patientDetail.initials}</div>
              <div>
                <p className="chat-thread-name">{patientDetail.name}</p>
                <p className="text-muted" style={{ margin: '2px 0 0' }}>{patientDetail.condition}</p>
              </div>
            </div>

            <div className="chat-canvas">
              {patientDetail.messages.map((message, index) => (
                <div key={index} className={`message-bubble ${message.type === 'to' ? 'message-to' : 'message-from'}`}>
                  {message.text}
                  <div className="message-time">{message.time}</div>
                </div>
              ))}
            </div>

            <div className="chat-suggest-row">
              <span className="filter-pill">Thank you for the reading.</span>
              <span className="filter-pill">Drink water.</span>
              <span className="filter-pill">Come to the clinic tomorrow morning.</span>
            </div>

            <div className="chat-input-row">
              <input type="text" placeholder="Write a short, warm reply..." />
              <button className="primary small">Send</button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
