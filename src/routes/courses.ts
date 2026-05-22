import { Router, Request, Response } from "express";
import { CreateCourseSchema } from "../validators/schemas";
import { prisma } from "../db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/role";

const router = Router();

router.post("/", authMiddleware, requireRole("INSTRUCTOR"), async (req: Request, res: Response) => {
  const parsed = CreateCourseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message, statusCode: 400, timestamp: new Date().toISOString() });
    return;
  }

  const course = await prisma.course.create({
    data: { ...parsed.data, instructorId: req.userId },
  });

  res.status(201).json(course);
});

router.get("/", async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.course.findMany({ skip, take: limit, include: { instructor: { select: { id: true, name: true, email: true } } } }),
    prisma.course.count(),
  ]);

  res.json({ data, total, page, limit });
});

router.get("/:id", async (req: Request, res: Response) => {
  const course = await prisma.course.findUnique({
    where: { id: req.params.id },
    include: {
      instructor: { select: { id: true, name: true, email: true } },
      lessons: true,
    },
  });

  if (!course) {
    res.status(404).json({ error: "Course not found", statusCode: 404, timestamp: new Date().toISOString() });
    return;
  }

  res.json(course);
});

router.patch("/:id", authMiddleware, requireRole("INSTRUCTOR"), async (req: Request, res: Response) => {
  const course = await prisma.course.findUnique({ where: { id: req.params.id } });
  if (!course) {
    res.status(404).json({ error: "Course not found", statusCode: 404, timestamp: new Date().toISOString() });
    return;
  }
  if (course.instructorId !== req.userId) {
    res.status(403).json({ error: "Not your course", statusCode: 403, timestamp: new Date().toISOString() });
    return;
  }

  const parsed = CreateCourseSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message, statusCode: 400, timestamp: new Date().toISOString() });
    return;
  }

  const updated = await prisma.course.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(updated);
});

router.delete("/:id", authMiddleware, requireRole("INSTRUCTOR"), async (req: Request, res: Response) => {
  const course = await prisma.course.findUnique({ where: { id: req.params.id } });
  if (!course) {
    res.status(404).json({ error: "Course not found", statusCode: 404, timestamp: new Date().toISOString() });
    return;
  }
  if (course.instructorId !== req.userId) {
    res.status(403).json({ error: "Not your course", statusCode: 403, timestamp: new Date().toISOString() });
    return;
  }

  await prisma.course.delete({ where: { id: req.params.id } });
  res.json({ message: "Course deleted" });
});

router.get("/:id/stats", authMiddleware, requireRole("INSTRUCTOR"), async (req: Request, res: Response) => {
  const course = await prisma.course.findUnique({ where: { id: req.params.id } });
  if (!course) {
    res.status(404).json({ error: "Course not found", statusCode: 404, timestamp: new Date().toISOString() });
    return;
  }
  if (course.instructorId !== req.userId) {
    res.status(403).json({ error: "Not your course", statusCode: 403, timestamp: new Date().toISOString() });
    return;
  }

  const purchases = await prisma.purchase.count({ where: { courseId: req.params.id } });

  res.json({
    totalPurchases: purchases,
    totalRevenue: purchases * course.price,
    coursePrice: course.price,
  });
});

export default router;
