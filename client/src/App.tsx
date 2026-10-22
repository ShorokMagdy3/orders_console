import { useCallback, useState } from "react";
import LoginForm from "./components/LoginForm";
import OrdersList from "./components/OrdersList";
import type { AuthUser } from "./types";
import "./App.css";

// sessionStorage: cleared when the tab closes. See README for the trade-off.
function readSavedUser(): AuthUser | null {
  try {
    const saved = sessionStorage.getItem("user");
    return saved ? (JSON.parse(saved) as AuthUser) : null;
  } catch {
    return null;
  }
}

function App() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem("token") ?? "",
  );
  const [user, setUser] = useState<AuthUser | null>(readSavedUser);

  function handleLogin(newToken: string, newUser: AuthUser) {
    sessionStorage.setItem("token", newToken);
    sessionStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  // useCallback: OrdersList has this in its effect dependencies.
  const logout = useCallback(() => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    setToken("");
    setUser(null);
  }, []);

  if (!token || !user) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1>Orders Console</h1>
          <p>
            Signed in as {user.name} ({user.role})
          </p>
        </div>
        <button className="secondary" onClick={logout}>
          Log out
        </button>
      </header>

      <OrdersList token={token} user={user} onUnauthorized={logout} />
    </main>
  );
}

export default App;