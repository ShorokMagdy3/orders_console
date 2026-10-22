import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { apiRequest, ApiError } from "../api";

interface Props {
  token: string;
  onCreated: () => void;
  onUnauthorized: () => void;
}

export default function CreateOrderForm({
  token,
  onCreated,
  onUnauthorized,
}: Props) {
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(10);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // A ref (not state) is updated immediately, so a fast second click is
  // blocked even before React re-renders the disabled button.
  const inFlight = useRef(false);

  // The Idempotency-Key belongs to one submission. A retry of the same data
  // reuses the key; changed data gets a new key. Cleared after success.
  const attempt = useRef<{ key: string; body: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;

    const body = JSON.stringify({
      customerName,
      customerEmail,
      items: [{ name: itemName, quantity, unitPrice }],
    });

    if (!attempt.current || attempt.current.body !== body) {
      attempt.current = { key: crypto.randomUUID(), body };
    }

    inFlight.current = true;
    setCreating(true);
    setError("");

    try {
      await apiRequest(
        "/api/orders",
        {
          method: "POST",
          headers: { "Idempotency-Key": attempt.current.key },
          body,
        },
        token,
      );

      attempt.current = null;
      setCustomerName("");
      setCustomerEmail("");
      setItemName("");
      setQuantity(1);
      setUnitPrice(10);
      onCreated();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onUnauthorized();
        return;
      }
      setError(err instanceof Error ? err.message : "Could not create order");
    } finally {
      inFlight.current = false;
      setCreating(false);
    }
  }

  return (
    <section className="panel">
      <h2>Create order</h2>
      <form className="create-form" onSubmit={handleSubmit}>
        <label>
          Customer name
          <input
            required
            minLength={2}
            maxLength={120}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </label>

        <label>
          Customer email
          <input
            type="email"
            required
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
          />
        </label>

        <label>
          Item name
          <input
            required
            maxLength={150}
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
          />
        </label>

        <label>
          Quantity
          <input
            type="number"
            min={1}
            max={10000}
            step={1}
            required
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </label>

        <label>
          Unit price
          <input
            type="number"
            min={0}
            max={1000000}
            step="0.01"
            required
            value={unitPrice}
            onChange={(e) => setUnitPrice(Number(e.target.value))}
          />
        </label>

        <button type="submit" disabled={creating}>
          {creating ? "Creating..." : "Create order"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  );
}