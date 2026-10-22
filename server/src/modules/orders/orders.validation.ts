
import { z } from "zod";

export const createOrderSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  customerEmail: z.string().trim().email().max(254),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(150),
        quantity: z.number().int().min(1).max(10000),
        unitPrice: z.number().finite().min(0).max(1_000_000),
      })
    )
    .min(1)
    .max(100),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;


export const listOrdersSchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum([
    "pending",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ]).optional(),
  sortBy: z.enum(["date", "amount"]).default("date"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListOrdersInput = z.infer<typeof listOrdersSchema>;