import { z } from "zod";

export const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(["STUDENT", "INSTRUCTOR"]),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const CreateCourseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().min(0),
});

export const CreateLessonSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  courseId: z.string().uuid(),
});

export const PurchaseCourseSchema = z.object({
  courseId: z.string().uuid(),
});
