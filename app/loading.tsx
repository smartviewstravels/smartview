/**
 * Loading skeleton shown while a page loads or while switching modules.
 * Plain grey blocks matching the page shape (title + stat cards + a
 * content card) so the app answers instantly instead of a blank wait.
 */
export default function Loading() {
  return (
    <div>
      <div className="skeleton" style={{ width: 200, height: 28 }} />
      <div className="stat-grid" style={{ marginTop: 16 }}>
        <div className="card skeleton" style={{ height: 96 }} />
        <div className="card skeleton" style={{ height: 96 }} />
        <div className="card skeleton" style={{ height: 96 }} />
        <div className="card skeleton" style={{ height: 96 }} />
      </div>
      <div className="card skeleton" style={{ height: 180, marginTop: 16 }} />
    </div>
  );
}
