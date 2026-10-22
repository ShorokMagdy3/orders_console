import { useEffect, useState } from "react";
import { apiRequest, ApiError } from "../api";
import { useDebounce } from "../hooks/useDebounce";
import type { AuthUser, Order, OrdersResponse, OrderStatus } from "../types";

const statuses: OrderStatus[] = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

interface Props {
  token: string;
  user: AuthUser;
  onUnauthorized: () => void;
}

export default function OrdersList({ token, user, onUnauthorized }: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const debouncedSearch = useDebounce(search);

  useEffect(() => {
    // Every change of filter/sort/page runs this cleanup first, which aborts
    // the previous request. A slow old response therefore can never overwrite
    // the result of the latest one. `ignore` is a second guard in case the
    // response arrives right as the effect is being cleaned up.
    const controller = new AbortController();
    let ignore = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          sortBy,
          sortOrder,
          page: String(page),
          limit: "20",
        });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (status) params.set("status", status);

        const result = await apiRequest<OrdersResponse>(
          `/api/orders?${params}`,
          { signal: controller.signal },
          token,
        );

        if (ignore) return;
        setOrders(result.data);
        setTotal(result.pagination.total);
        setTotalPages(result.pagination.totalPages);
        setLoading(false);
      } catch (err) {
        if (ignore || (err instanceof Error && err.name === "AbortError")) {
          return;
        }
        if (err instanceof ApiError && err.status === 401) {
          onUnauthorized();
          return;
        }
        setError(err instanceof Error ? err.message : "Could not load orders");
        setLoading(false);
      }
    }

    void load();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [debouncedSearch, status, sortBy, sortOrder, page, reload, token, onUnauthorized]);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this order? This cannot be undone.")) return;

    try {
      await apiRequest(`/api/orders/${id}`, { method: "DELETE" }, token);
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete order");
    }
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Orders</h2>
          <p>
            {loading ? "Loading..." : `${total.toLocaleString()} matching orders`}
          </p>
        </div>
      </div>

      <div className="filters">
        <label>
          Search customer
          <input
            placeholder="Name or email (starts with)"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>

        <label>
          Status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label>
          Sort by
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
          >
            <option value="date">Date</option>
            <option value="amount">Amount</option>
          </select>
        </label>

        <label>
          Direction
          <select
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value);
              setPage(1);
            }}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <div className={`table-wrapper${loading ? " loading" : ""}`}>
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Email</th>
              <th>Status</th>
              <th className="num">Items</th>
              <th className="num">Total</th>
              <th>Created</th>
              {user.role === "admin" && <th></th>}
            </tr>
          </thead>
          <tbody>
            {!loading && orders.length === 0 && (
              <tr>
                <td className="empty" colSpan={7}>
                  No orders match your search.
                </td>
              </tr>
            )}

            {orders.map((order) => (
              <tr key={order._id}>
                <td>{order.customerName}</td>
                <td>{order.customerEmail}</td>
                <td>
                  <span className={`status status-${order.status}`}>
                    {order.status}
                  </span>
                </td>
                <td className="num">{order.items.length}</td>
                <td className="num">{order.total.toFixed(2)}</td>
                <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                {user.role === "admin" && (
                  <td>
                    <button
                      className="danger"
                      onClick={() => handleDelete(order._id)}
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button
          className="secondary"
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>
        <span>
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <button
          className="secondary"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}