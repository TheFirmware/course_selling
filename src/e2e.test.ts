import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { prisma } from "../src/db";

const BASE = "http://localhost:3001";

let studentToken = "";
let instructorToken = "";
let studentId = "";
let instructorId = "";
let courseId = "";

beforeAll(async () => {
  await prisma.purchase.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.course.deleteMany();
  await prisma.user.deleteMany();

  const sSignup = await fetch(`${BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "student@test.com", password: "test1234", name: "Student One", role: "STUDENT" }),
  });
  const sData = await sSignup.json();
  studentToken = sData.token;
  studentId = sData.user.id;

  const iSignup = await fetch(`${BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "instructor@test.com", password: "test1234", name: "Instructor One", role: "INSTRUCTOR" }),
  });
  const iData = await iSignup.json();
  instructorToken = iData.token;
  instructorId = iData.user.id;
});

afterAll(async () => {
  await prisma.purchase.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.course.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

describe("Auth", () => {
  it("signs up a new user", async () => {
    const res = await fetch(`${BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `unique-${Date.now()}@test.com`, password: "abcd1234", name: "Temp", role: "STUDENT" }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.token).toBeDefined();
    expect(data.user.role).toBe("STUDENT");
  });

  it("rejects duplicate email signup", async () => {
    const res = await fetch(`${BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "student@test.com", password: "test1234", name: "Dup", role: "STUDENT" }),
    });
    expect(res.status).toBe(409);
  });

  it("rejects signup with short password", async () => {
    const res = await fetch(`${BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bad@test.com", password: "12", name: "Bad", role: "STUDENT" }),
    });
    expect(res.status).toBe(400);
  });

  it("logs in with valid credentials", async () => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "student@test.com", password: "test1234" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBeDefined();
  });

  it("rejects login with wrong password", async () => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "student@test.com", password: "wrongpass" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("Courses", () => {
  it("allows instructor to create a course", async () => {
    const res = await fetch(`${BASE}/courses`, {
      method: "POST",
      headers: auth(instructorToken),
      body: JSON.stringify({ title: "Node.js Basics", description: "Learn Node.js fundamentals", price: 2999 }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.title).toBe("Node.js Basics");
    expect(data.price).toBe(2999);
    courseId = data.id;
  });

  it("rejects student from creating a course", async () => {
    const res = await fetch(`${BASE}/courses`, {
      method: "POST",
      headers: auth(studentToken),
      body: JSON.stringify({ title: "Hack Course", price: 100 }),
    });
    expect(res.status).toBe(403);
  });

  it("lists courses with pagination", async () => {
    const res = await fetch(`${BASE}/courses?page=1&limit=5`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("data");
    expect(data).toHaveProperty("total");
    expect(data).toHaveProperty("page", 1);
    expect(data).toHaveProperty("limit", 5);
    expect(Array.isArray(data.data)).toBe(true);
  });

  it("gets a course by id with lessons", async () => {
    const res = await fetch(`${BASE}/courses/${courseId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(courseId);
    expect(data.lessons).toBeDefined();
    expect(data.instructor).toBeDefined();
  });

  it("returns 404 for non-existent course", async () => {
    const res = await fetch(`${BASE}/courses/00000000-0000-0000-0000-000000000000`);
    expect(res.status).toBe(404);
  });

  it("allows instructor to update own course", async () => {
    const res = await fetch(`${BASE}/courses/${courseId}`, {
      method: "PATCH",
      headers: auth(instructorToken),
      body: JSON.stringify({ title: "Node.js Advanced", price: 3999 }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBe("Node.js Advanced");
    expect(data.price).toBe(3999);
  });

  it("rejects another instructor from updating course", async () => {
    const email = `other-${Date.now()}@test.com`;
    const iSignup = await fetch(`${BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "test1234", name: "Other Instructor", role: "INSTRUCTOR" }),
    });
    const { token } = await iSignup.json();

    const res = await fetch(`${BASE}/courses/${courseId}`, {
      method: "PATCH",
      headers: auth(token),
      body: JSON.stringify({ title: "Stolen Course" }),
    });
    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated course creation", async () => {
    const res = await fetch(`${BASE}/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "No Auth", price: 100 }),
    });
    expect(res.status).toBe(401);
  });
});

describe("Lessons", () => {
  it("allows course instructor to add a lesson", async () => {
    const res = await fetch(`${BASE}/lessons`, {
      method: "POST",
      headers: auth(instructorToken),
      body: JSON.stringify({ title: "Intro to Node", content: "Node.js is a runtime...", courseId }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.title).toBe("Intro to Node");
    expect(data.courseId).toBe(courseId);
  });

  it("rejects non-instructor from adding lessons", async () => {
    const res = await fetch(`${BASE}/lessons`, {
      method: "POST",
      headers: auth(studentToken),
      body: JSON.stringify({ title: "Bad Lesson", content: "Hack", courseId }),
    });
    expect(res.status).toBe(403);
  });

  it("rejects lesson creation for another instructor's course", async () => {
    const email = `instr-${Date.now()}@test.com`;
    const iSignup = await fetch(`${BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "test1234", name: "Another", role: "INSTRUCTOR" }),
    });
    const { token } = await iSignup.json();
    const res = await fetch(`${BASE}/lessons`, {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify({ title: "Unauthorized Lesson", content: "Secret", courseId }),
    });
    expect(res.status).toBe(403);
  });

  it("gets lessons for a course publicly", async () => {
    const res = await fetch(`${BASE}/courses/${courseId}/lessons`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });
});

describe("Purchases", () => {
  it("allows student to purchase a course", async () => {
    const res = await fetch(`${BASE}/purchases`, {
      method: "POST",
      headers: auth(studentToken),
      body: JSON.stringify({ courseId }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.course).toBeDefined();
    expect(data.courseId).toBe(courseId);
  });

  it("rejects instructor from purchasing", async () => {
    const res = await fetch(`${BASE}/purchases`, {
      method: "POST",
      headers: auth(instructorToken),
      body: JSON.stringify({ courseId }),
    });
    expect(res.status).toBe(403);
  });

  it("prevents duplicate purchases", async () => {
    const res = await fetch(`${BASE}/purchases`, {
      method: "POST",
      headers: auth(studentToken),
      body: JSON.stringify({ courseId }),
    });
    expect(res.status).toBe(409);
  });

  it("gets user purchases with pagination", async () => {
    const res = await fetch(`${BASE}/users/${studentId}/purchases?page=1&limit=5`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("data");
    expect(data).toHaveProperty("total");
    expect(data).toHaveProperty("page");
    expect(data).toHaveProperty("limit");
  });
});

describe("Stats", () => {
  it("returns course revenue stats for the instructor", async () => {
    const res = await fetch(`${BASE}/courses/${courseId}/stats`, {
      headers: auth(instructorToken),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("totalPurchases");
    expect(data).toHaveProperty("totalRevenue");
    expect(data).toHaveProperty("coursePrice");
    expect(data.totalPurchases).toBeGreaterThanOrEqual(1);
    expect(data.totalRevenue).toBe(data.totalPurchases * data.coursePrice);
  });
});

describe("Edge cases", () => {
  it("returns error format with timestamp", async () => {
    const res = await fetch(`${BASE}/courses/00000000-0000-0000-0000-000000000000`);
    const data = await res.json();
    expect(data).toHaveProperty("error");
    expect(data).toHaveProperty("statusCode");
    expect(data).toHaveProperty("timestamp");
  });

  it("handles invalid JSON body gracefully", async () => {
    const res = await fetch(`${BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-valid-json",
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("rejects missing auth token", async () => {
    const res = await fetch(`${BASE}/purchases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId }),
    });
    expect(res.status).toBe(401);
  });

  it("paginates courses correctly with different page sizes", async () => {
    const res1 = await fetch(`${BASE}/courses?page=1&limit=1`);
    const d1 = await res1.json();
    expect(d1.limit).toBe(1);

    const res2 = await fetch(`${BASE}/courses?page=1&limit=50`);
    const d2 = await res2.json();
    expect(d2.limit).toBe(50);
  });
});
