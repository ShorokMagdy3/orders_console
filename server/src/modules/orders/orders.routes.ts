import { Router } from "express";
import {
  authenticateToken,
  requireRole,
} from "../../middleware/auth.middleware";
import {
  createOrderController,
  deleteOrderController,
  listOrdersController,
} from "./orders.controller";

const router = Router();

router.use(authenticateToken);

router.get("/", listOrdersController);
router.post("/", createOrderController);
router.delete("/:id", requireRole("admin"), deleteOrderController);

export default router;