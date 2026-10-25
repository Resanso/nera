import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { riskRouter } from "./routes/risk";
import { simulationRouter } from "./routes/simulation";
import { coachRouter } from "./routes/coach";
import { bniMockRouter } from "./routes/bni-mock";
import { emailRouter } from "./routes/email";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// API Routes
app.use("/api/risk", riskRouter);
app.use("/api/simulation", simulationRouter);
app.use("/api/coach", coachRouter);
app.use("/api/bni", bniMockRouter);
app.use("/api/email", emailRouter);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "NERA Financial Safety Engine",
    timestamp: new Date().toISOString(),
  });
});

app.listen(port, () => {
  console.log(`[NERA API] Server running on http://localhost:${port}`);
});
