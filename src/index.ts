import "express-async-errors";
import express from "express";
import authRoutes from "./routes/auth";
import courseRoutes from "./routes/courses";
import lessonRoutes from "./routes/lessons";
import purchaseRoutes from "./routes/purchases";
import { errorHandler } from "./middleware/error";

const app = express();
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/courses", courseRoutes);
app.use(lessonRoutes);
app.use(purchaseRoutes);

app.use(errorHandler);

export default app;

const isMain = import.meta.main;
if (isMain) {
  const port = parseInt(process.env.PORT || "3000");
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}
