
import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

export interface AuthUser {
  id: string;
  role: "admin" | "agent";
}

export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const [scheme, token] = authHeader?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    res.status(401).json({
      success: false,
      message: "Authentication token is required",
    });
    return;
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret || jwtSecret.length < 32) {
    res.status(500).json({
      success: false,
      message: "Authentication is not configured correctly",
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret, { algorithms: ["HS256"] });

    if (typeof decoded === "string") {
      res.status(401).json({
        success: false,
        message: "Invalid token",
      });
      return;
    }

    const payload = decoded as JwtPayload;

    if (
      typeof payload.sub !== "string" ||
      (payload.role !== "admin" && payload.role !== "agent")
    ) {
      res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
      return;
    }

    res.locals.authUser = {
      id: payload.sub,
      role: payload.role,
    } satisfies AuthUser;

    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}

export function requireRole(...allowedRoles: AuthUser["role"][]) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const user = res.locals.authUser as AuthUser | undefined;

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
      return;
    }

    next();
  };
}