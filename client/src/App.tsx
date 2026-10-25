import { APP_NAME } from '@celebraitions/shared';

export function App() {
  return (
    <main className="shell">
      <div className="eyebrow">Your celebration, made clearer</div>
      <h1>{APP_NAME}</h1>
      <p className="lead">
        A thoughtful event planning assistant that turns a blank page into a plan you can
        actually enjoy.
      </p>
      <div className="status-card" role="status">
        <span className="status-dot" aria-hidden="true" />
        Workspace ready — the planning engine is coming next.
      </div>
    </main>
  );
}
