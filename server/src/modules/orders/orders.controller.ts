
import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

import type { AuthUser } from "../../middleware/auth.middleware";
import { createOrderSchema, listOrdersSchema } from "./orders.validation";
import { createOrder, deleteOrder, listOrders, OrderConflictError } from "./orders.service";

export async function createOrderController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = createOrderSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const idempotencyKey = req.get("Idempotency-Key");

    if (
      !idempotencyKey ||
      idempotencyKey.length > 128 ||
      !/^[a-zA-Z0-9._:-]+$/.test(idempotencyKey)
    ) {
      res.status(400).json({
        success: false,
        message: "A valid Idempotency-Key header is required",
      });
      return;
    }

    const user = res.locals.authUser as AuthUser;

    const result = await createOrder(
      user.id,
      idempotencyKey,
      parsed.data
    );

    res.status(result.replayed ? 200 : 201).json({
      success: true,
      replayed: result.replayed,
      data: result.order,
    });
  } catch (error) {
    if (error instanceof OrderConflictError) {
      res.status(409).json({
        success: false,
        message: error.message,
      });
      return;
    }

    next(error);
  }
}


export async function listOrdersController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = listOrdersSchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid query parameters",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const result = await listOrders(parsed.data);

    res.status(200).json({
      success: true,
      data: result.orders,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteOrderController(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid order id" });
      return;
    }

    const deleted = await deleteOrder(id);

    if (!deleted) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
}