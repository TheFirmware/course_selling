import { Request, Response, NextFunction } from "express";

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.role)) {
      res.status(403).json({ error: "Forbidden", statusCode: 403, timestamp: new Date().toISOString() });
      return;
    }
    next();
  };
}
