import { Router, Request, Response } from "express";
import { PurchaseCourseSchema } from "../validators/schemas";
import { prisma } from "../db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/role";

const router = Router();

router.post("/purchases", authMiddleware, requireRole("STUDENT"), async (req: Request, res: Response) => {
  const parsed = PurchaseCourseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message, statusCode: 400, timestamp: new Date().toISOString() });
    return;
  }

  const course = await prisma.course.findUnique({ where: { id: parsed.data.courseId } });
  if (!course) {
    res.status(404).json({ error: "Course not found", statusCode: 404, timestamp: new Date().toISOString() });
    return;
  }

  const existing = await prisma.purchase.findUnique({
    where: { userId_courseId: { userId: req.userId, courseId: parsed.data.courseId } },
  });
  if (existing) {
    res.status(409).json({ error: "Already purchased", statusCode: 409, timestamp: new Date().toISOString() });
    return;
  }

  const purchase = await prisma.$transaction(async (tx) => {
    return tx.purchase.create({
      data: { userId: req.userId, courseId: parsed.data.courseId },
      include: { course: true },
    });
  });

  res.status(201).json(purchase);
});

router.get("/users/:id/purchases", async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
  const skip = (page - 1) * limit;

  const userId = req.params.id;

  const [data, total] = await Promise.all([
    prisma.purchase.findMany({
      where: { userId },
      skip,
      take: limit,
      include: { course: true },
    }),
    prisma.purchase.count({ where: { userId } }),
  ]);

  res.json({ data, total, page, limit });
});

export default router;
