import { inventoryItems } from '../../lib/dummy';
import { Sidebar } from '../../components/Sidebar';
import { ProtectedRoute } from '../../components/ProtectedRoute';

export default function InventoryPage() {
  return (
    <ProtectedRoute requiredRole="pharmacist">
      <div className="app-shell">
        <Sidebar />
        <main className="content hcp-page">
          <div className="hcp-page-header">
            <div>
              <h1 className="hcp-page-title">Inventory Management</h1>
              <p className="subtitle">Monitor medication stock levels and reorder when necessary.</p>
            </div>
          </div>

          <section className="panel hcp-panel">
            <div className="panel-headline-row" style={{ marginBottom: 16 }}>
              <div>
                <p className="panel-title">Drug Stock Levels</p>
                <p className="text-muted">{inventoryItems.length} medications in stock</p>
              </div>
              <button className="text-link">Request Restock</button>
            </div>

            <table className="table hcp-table">
              <thead>
                <tr>
                  <th>Medication Name</th>
                  <th>Current Stock</th>
                  <th>Minimum Level</th>
                  <th>Unit</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {inventoryItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.stock}</td>
                    <td>{item.minimum}</td>
                    <td>{item.unit}</td>
                    <td>
                      <span className={`status-pill status-${item.status.toLowerCase()}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="row-arrow">&gt;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
