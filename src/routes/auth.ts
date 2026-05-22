import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { SignupSchema, LoginSchema } from "../validators/schemas";
import { prisma } from "../db";

const router = Router();

router.post("/signup", async (req: Request, res: Response) => {
  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message, statusCode: 400, timestamp: new Date().toISOString() });
    return;
  }

  const { email, password, name, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "Email already registered", statusCode: 409, timestamp: new Date().toISOString() });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, password: hashedPassword, name, role },
  });

  const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET!);

  res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

router.post("/login", async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message, statusCode: 400, timestamp: new Date().toISOString() });
    return;
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: "Invalid credentials", statusCode: 401, timestamp: new Date().toISOString() });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials", statusCode: 401, timestamp: new Date().toISOString() });
    return;
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET!);

  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

export default router;
