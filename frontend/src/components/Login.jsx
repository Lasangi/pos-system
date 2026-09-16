import { useState } from "react";

function Login({ setupStatus, onAuthenticated, onRequireSetupReset }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const needsFirstAdmin = Boolean(setupStatus?.requireFirstAdmin);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = needsFirstAdmin ? "/api/auth/first-admin" : "/api/auth/login";
      const payload = needsFirstAdmin
        ? { full_name: fullName, username, email, password }
        : { username, password };

      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Authentication failed");
      }

      if (onAuthenticated) {
        onAuthenticated(data.user || null);
      }
    } catch (submitError) {
      setError(submitError.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-header">
          <h1>{needsFirstAdmin ? "Create First Admin" : "Welcome Back"}</h1>
          <p>
            {needsFirstAdmin
              ? "This system has no user accounts yet. Create the first administrator to continue."
              : "Sign in to access the POS dashboard and sales tools."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {needsFirstAdmin && (
            <label>
              Full name
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="John Smith"
                required
              />
            </label>
          )}

          <label>
            Username
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="admin"
              required
            />
          </label>

          {!needsFirstAdmin && (
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
              />
            </label>
          )}

          {needsFirstAdmin && (
            <>
              <label>
                Email (optional)
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@example.com"
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Create a strong password"
                  required
                />
              </label>
            </>
          )}

          {error && <div className="error-box auth-error">{error}</div>}

          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
            {loading ? (needsFirstAdmin ? "Creating admin..." : "Signing in...") : needsFirstAdmin ? "Create Admin" : "Sign In"}
          </button>
        </form>

        {!needsFirstAdmin && onRequireSetupReset && (
          <div className="auth-helper">
            <button type="button" className="btn btn-secondary" onClick={onRequireSetupReset}>
              Check setup status
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;
