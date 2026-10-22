
import { Router } from "express";
import { loginController } from "./auth.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import type { AuthUser } from "../../middleware/auth.middleware";

const router = Router();

router.post("/login", loginController);

router.get("/me", authenticateToken, (_req, res) => {
  const user = res.locals.authUser as AuthUser;

  res.status(200).json({
    success: true,
    data: user,
  });
});

export default router;