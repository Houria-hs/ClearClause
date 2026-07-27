const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
dotenv.config();

const { clientUrl } = require("./config/env.js");
const authRoutes = require("./routes/authRoutes.js");
const pdfRoutes = require("./routes/pdfRoutes.js");
const documentRoutes = require("./routes/documentRoutes.js");
const comparisonRoutes = require("./routes/comparisonRoutes.js");
const pool = require("./config/db.js");

const app = express();

const allowedOrigins = [clientUrl()];

const corsOptions = {
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200 
};

//  the middleware
app.use(cors(corsOptions));

app.options(/(.*)/, cors(corsOptions));
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("Health check database error:", { code: error.code, message: error.message });
    return res.status(503).json({ status: "database_unavailable" });
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/pdf", pdfRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/compare", comparisonRoutes);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
