import { Router, Request, Response } from "express";
import { CreateLessonSchema } from "../validators/schemas";
import { prisma } from "../db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/role";

const router = Router();

router.post("/lessons", authMiddleware, requireRole("INSTRUCTOR"), async (req: Request, res: Response) => {
  const parsed = CreateLessonSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message, statusCode: 400, timestamp: new Date().toISOString() });
    return;
  }

  const course = await prisma.course.findUnique({ where: { id: parsed.data.courseId } });
  if (!course) {
    res.status(404).json({ error: "Course not found", statusCode: 404, timestamp: new Date().toISOString() });
    return;
  }
  if (course.instructorId !== req.userId) {
    res.status(403).json({ error: "Not your course", statusCode: 403, timestamp: new Date().toISOString() });
    return;
  }

  const lesson = await prisma.lesson.create({ data: parsed.data });
  res.status(201).json(lesson);
});

router.get("/courses/:courseId/lessons", async (req: Request, res: Response) => {
  const lessons = await prisma.lesson.findMany({ where: { courseId: req.params.courseId } });
  res.json(lessons);
});

export default router;
