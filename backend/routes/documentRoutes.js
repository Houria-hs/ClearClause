const express = require("express");
const crypto = require("crypto");
const pool = require("../config/db.js");
const verifyToken = require("../middleware/authMiddleware.js");
const { askDocumentQuestion, createDocumentFallbackAnswer, MAX_QUESTION_LENGTH } = require("../services/documentAssistant.js");

const router = express.Router();

router.post("/test/seed", verifyToken, async (req, res) => {
  if (process.env.NODE_ENV !== "test") return res.status(404).json({ message: "Not found" });
  const { filename = "Test agreement.pdf", extractedText, analysis = [] } = req.body;
  if (typeof extractedText !== "string" || !extractedText.trim()) return res.status(400).json({ error: "Document text is required." });
  try {
    const id = crypto.randomUUID();
    await pool.query(
      "INSERT INTO documents (id, user_id, filename, mime_type, extracted_text) VALUES ($1, $2, $3, $4, $5)",
      [id, req.userId, filename, "application/pdf", extractedText]
    );
    await pool.query("UPDATE documents SET analysis = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3", [JSON.stringify(analysis), id, req.userId]);
    return res.status(201).json({ documentId: id });
  } catch (error) {
    console.error("Test document seed error:", error.message);
    return res.status(500).json({ error: "Unable to seed test document." });
  }
});

// The chat page can be opened directly, so load its display metadata through
// the same ownership boundary as the question endpoint. Do not return the
// extracted document text to the browser.
router.get("/:documentId", verifyToken, async (req, res) => {
  const { documentId } = req.params;
  if (!documentId) return res.status(400).json({ error: "A document is required." });

  try {
    const result = await pool.query(
      "SELECT id, filename, mime_type, analysis FROM documents WHERE id = $1 AND user_id = $2",
      [documentId, req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Document not found or you do not have access." });

    const document = result.rows[0];
    return res.json({
      id: document.id,
      filename: document.filename,
      mimeType: document.mime_type,
      analysis: Array.isArray(document.analysis) ? document.analysis : [],
    });
  } catch (error) {
    console.error("Document metadata error", { documentId, userId: req.userId, message: error.message });
    return res.status(500).json({ error: "Unable to load this document." });
  }
});

router.post("/:documentId/ask", verifyToken, async (req, res) => {
  const { documentId } = req.params;
  const question = typeof req.body.question === "string" ? req.body.question.trim() : "";
  if (!documentId || !question) return res.status(400).json({ error: "A document and question are required." });
  if (question.length > MAX_QUESTION_LENGTH) return res.status(400).json({ error: "Questions must be 1,000 characters or fewer." });

  try {
    const result = await pool.query(
      "SELECT id, filename, extracted_text, analysis FROM documents WHERE id = $1 AND user_id = $2",
      [documentId, req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Document not found or you do not have access." });

    const response = await askDocumentQuestion({ question, document: result.rows[0] });
    return res.json({ documentId, answer: response.answer, sources: response.sources });
  } catch (error) {
    if (error.status === 429) {
      const documentResult = await pool.query(
        "SELECT id, filename, extracted_text, analysis FROM documents WHERE id = $1 AND user_id = $2",
        [documentId, req.userId]
      );
      if (documentResult.rows.length) {
        const fallback = createDocumentFallbackAnswer({ question, document: documentResult.rows[0] });
        return res.json({ documentId, ...fallback, notice: "AI answers are temporarily rate-limited; this is a document-based fallback." });
      }
    }
    const status = error.status === 429 ? 429 : 502;
    console.error("Document question error", {
      documentId,
      userId: req.userId,
      name: error.name,
      status: error.status,
      message: error.message,
    });
    const response = { error: status === 429 ? "Ask ClearClause is busy. Please try again shortly." : "Ask ClearClause is temporarily unavailable. Please try again." };
    if (process.env.NODE_ENV === "development") response.debug = error.message;
    return res.status(status).json(response);
  }
});

module.exports = router;
