const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { PDFExtract } = require("pdf.js-extract");
const verifyToken = require("../middleware/authMiddleware.js");
const { compareContracts } = require("../services/contractComparisonService.js");

const router = express.Router();
const pdfExtract = new PDFExtract();
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const upload = multer({ dest: "uploads/", limits: { fileSize: MAX_FILE_SIZE } });

const isPdf = (file) => {
  if (!file || (file.mimetype !== "application/pdf" && !file.originalname?.toLowerCase().endsWith(".pdf"))) return false;
  try {
    return fs.readFileSync(path.resolve(file.path)).subarray(0, 5).toString("ascii") === "%PDF-";
  } catch {
    return false;
  }
};
const removeTemporaryFile = (file) => {
  if (!file?.path) return;
  try { fs.unlinkSync(path.resolve(file.path)); } catch (error) { if (error.code !== "ENOENT") console.error("Comparison upload cleanup error:", error.message); }
};
const extractText = (file) => new Promise((resolve, reject) => {
  pdfExtract.extract(path.resolve(file.path), {}, (error, data) => {
    if (error) return reject(error);
    const text = data.pages.map((page) => page.content.map((item) => item.str).join(" ")).join("\n").trim();
    if (text.length < 50) return reject(Object.assign(new Error("This file contains no readable contract text."), { status: 422 }));
    resolve(text);
  });
});

router.post("/", verifyToken, upload.fields([{ name: "contractA", maxCount: 1 }, { name: "contractB", maxCount: 1 }]), async (req, res) => {
  const contractAFile = req.files?.contractA?.[0];
  const contractBFile = req.files?.contractB?.[0];

  try {
    if (!contractAFile) return res.status(400).json({ error: "Contract A is required." });
    if (!contractBFile) return res.status(400).json({ error: "Contract B is required." });
    if (!isPdf(contractAFile) || !isPdf(contractBFile)) return res.status(400).json({ error: "Both contracts must be PDF files." });
    if (process.env.NODE_ENV === "test" && req.get("x-test-compare-failure") === "1") {
      const error = new Error("Simulated comparison provider failure");
      error.status = 503;
      throw error;
    }

    const [contractAText, contractBText] = await Promise.all([extractText(contractAFile), extractText(contractBFile)]);
    const comparison = await compareContracts({
      contractA: { filename: contractAFile.originalname, text: contractAText },
      contractB: { filename: contractBFile.originalname, text: contractBText },
    });
    return res.json({ contractA: { filename: contractAFile.originalname }, contractB: { filename: contractBFile.originalname }, comparison });
  } catch (error) {
    const status = error.status === 422 ? 422 : error.status === 503 ? 502 : 500;
    console.error("Contract comparison error", { userId: req.userId, status: error.status, message: error.message });
    return res.status(status).json({ error: status === 422 ? error.message : "Contract comparison is temporarily unavailable. Please try again." });
  } finally {
    removeTemporaryFile(contractAFile);
    removeTemporaryFile(contractBFile);
  }
});

router.use((error, req, res, _next) => {
  Object.values(req.files || {}).flat().forEach(removeTemporaryFile);
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "Each contract must be 10 MB or smaller." });
  if (error) return res.status(400).json({ error: "Unable to upload the contracts." });
});

module.exports = router;
