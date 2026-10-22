import { useCallback, useState } from "react";
import CreateOrderForm from "./components/CreateOrderForm";
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
  // Changing this key remounts the list: filters reset to "newest first"
  // and the new order shows up on page 1.
  const [listKey, setListKey] = useState(0);

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

      <CreateOrderForm
        token={token}
        onCreated={() => setListKey((k) => k + 1)}
        onUnauthorized={logout}
      />
      <OrdersList
        key={listKey}
        token={token}
        user={user}
        onUnauthorized={logout}
      />
    </main>
  );
}

export default App;