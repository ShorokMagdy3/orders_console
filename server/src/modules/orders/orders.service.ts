import { createHash } from "node:crypto";
import mongoose from "mongoose";
import type { QueryFilter } from "mongoose";
import { Order } from "../../models/order.model";
import type { IOrder } from "../../models/order.model";
import { CreateOrderInput, ListOrdersInput } from "./orders.validation";

export class OrderConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderConflictError";
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}


export async function createOrder(
  userId: string,
  idempotencyKey: string,
  input: CreateOrderInput
) {
  const normalized = {
    customerName: input.customerName.trim(),
    customerEmail: input.customerEmail.trim().toLowerCase(),
    items: input.items.map((item) => ({
      name: item.name.trim(),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  };

  const requestHash = createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");

  async function findExisting() {
    const existing = await Order.findOne({ createdBy: userId, idempotencyKey });
    if (existing && existing.requestHash !== requestHash) {
      throw new OrderConflictError(
        "This Idempotency-Key was already used with different order data"
      );
    }
    return existing;
  }

  const existing = await findExisting();
  if (existing) return { order: existing, replayed: true };

  const total =
    Math.round(
      normalized.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0) *
        100
    ) / 100;

  try {
    const order = await Order.create({
      ...normalized,
      customerNameLower: normalized.customerName.toLowerCase(),
      status: "pending",
      total,
      createdBy: new mongoose.Types.ObjectId(userId),
      idempotencyKey,
      requestHash,
    });
    return { order, replayed: false };
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;

    const winner = await findExisting();
    if (!winner) throw error;
    return { order: winner, replayed: true };
  }
}

export async function listOrders(input: ListOrdersInput) {
  const filter: QueryFilter<IOrder> = {};

  if (input.status) {
    filter.status = input.status;
  }

  if (input.search) {
    const escaped = input.search
      .toLowerCase()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const prefix = new RegExp(`^${escaped}`);

    filter.$or = [{ customerNameLower: prefix }, { customerEmail: prefix }];
  }

  const sortField = input.sortBy === "amount" ? "total" : "createdAt";
  const direction = input.sortOrder === "asc" ? 1 : -1;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ [sortField]: direction, _id: direction })
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .select("-idempotencyKey -requestHash -customerNameLower")
      .lean(),
    Order.countDocuments(filter),
  ]);

  return {
    orders,
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}

export async function deleteOrder(id: string): Promise<boolean> {
  const deleted = await Order.findByIdAndDelete(id);
  return deleted !== null;
}