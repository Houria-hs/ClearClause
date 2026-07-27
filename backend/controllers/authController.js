const pool = require("../config/db.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { clientUrl, backendUrl } = require("../config/env.js");
require("dotenv").config();

const normalizedEmail = (email) => String(email || "").trim().toLowerCase();
const isDatabaseUnavailable = (error) => ["ENOTFOUND", "ETIMEDOUT", "ECONNREFUSED", "ECONNRESET", "08001", "08006", "57P01"].includes(error?.code);

async function sendVerificationEmail({ email, username, verificationToken }) {
  const verifyUrl = `${backendUrl()}/api/auth/verify-email?token=${encodeURIComponent(verificationToken)}`;

  // The test suite follows the same token link without needing a real mail provider.
  if (process.env.NODE_ENV === "test") return verifyUrl;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Email delivery is not configured");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  await transporter.sendMail({
    from: `"ClearClause" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify your ClearClause email",
    html: `<h2>Welcome ${username}</h2><p>Verify your ClearClause account:</p><p><a href="${verifyUrl}">Verify email</a></p><p>If you did not create this account, you can ignore this email.</p>`,
  });
  return verifyUrl;
}

exports.register = async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const email = normalizedEmail(req.body.email);
    const { password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: "Username, email, and password are required." });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length) return res.status(409).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const created = await pool.query(
      `INSERT INTO users (username, email, password, is_verified, verification_token)
       VALUES ($1, $2, $3, false, $4) RETURNING id`,
      [username, email, hashedPassword, verificationToken]
    );

    try {
      await sendVerificationEmail({ email, username, verificationToken });
    } catch (mailError) {
      await pool.query("DELETE FROM users WHERE id = $1", [created.rows[0].id]);
      throw mailError;
    }

    return res.status(201).json({ message: "Registration successful. Please check your email to verify your account." });
  } catch (err) {
    console.error("Register error:", { code: err.code, message: err.message });
    if (isDatabaseUnavailable(err)) {
      return res.status(503).json({ message: "Registration is temporarily unavailable. Please try again shortly." });
    }
    return res.status(500).json({ message: "Unable to create account. Please try again." });
  }
};

exports.login = async (req, res) => {
  try {
    const email = normalizedEmail(req.body.email);
    const { password } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (!result.rows.length) return res.status(401).json({ message: "Invalid email or password" });
    const user = result.rows[0];

    if (!await bcrypt.compare(password || "", user.password)) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    // Only the database boolean value true may receive a JWT. This rejects
    // false, null, undefined, 0, and any non-boolean value.
    if (user.is_verified !== true) {
      return res.status(403).json({ message: "Please verify your email first.", code: "EMAIL_NOT_VERIFIED", email: user.email });
    }
    if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured");

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "24h" });
    return res.json({ token, user: { id: user.id, username: user.username, email: user.email, hasOnboarded: user.has_onboarded } });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ message: "Unable to log in. Please try again." });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) return res.status(400).json({ message: "Invalid verification token." });

    // Resolve configuration before the state change. A bad redirect setting
    // must not verify an account; browser navigation happens after this reply.
    const redirectUrl = `${clientUrl()}/verify-email-success`;
    const result = await pool.query(
      `UPDATE users
       SET is_verified = true, verification_token = NULL
       WHERE verification_token = $1
       RETURNING id`,
      [token]
    );
    if (!result.rows.length) return res.status(400).json({ message: "Invalid or already-used verification token." });

    return res.redirect(redirectUrl);
  } catch (err) {
    console.error("Verification error:", err.message);
    return res.status(500).json({ message: "Verification failed." });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await pool.query("SELECT id, username, email, has_onboarded FROM users WHERE id = $1", [req.userId]);
    if (!user.rows.length) return res.status(404).json({ message: "User not found" });
    return res.json(user.rows[0]);
  } catch (err) {
    console.error("Profile error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.completeOnboarding = async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    if (!username) return res.status(400).json({ message: "A username is required." });
    await pool.query("UPDATE users SET has_onboarded = TRUE, username = $1 WHERE id = $2", [username, req.userId]);
    return res.json({ message: "Onboarding completed." });
  } catch (err) {
    console.error("Onboarding error:", err.message);
    return res.status(500).json({ message: "Update failed." });
  }
};

exports.getTestVerificationLink = async (req, res) => {
  if (process.env.NODE_ENV !== "test") return res.status(404).json({ message: "Not found" });
  try {
    const result = await pool.query("SELECT verification_token FROM users WHERE email = $1", [normalizedEmail(req.body.email)]);
    const token = result.rows[0]?.verification_token;
    if (!token) return res.status(404).json({ message: "Pending verification user not found." });
    return res.json({ verificationUrl: `${backendUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}` });
  } catch (err) {
    console.error("Test verification link error:", err.message);
    return res.status(500).json({ message: "Unable to retrieve test verification link." });
  }
};

exports.getTestUserState = async (req, res) => {
  if (process.env.NODE_ENV !== "test") return res.status(404).json({ message: "Not found" });
  try {
    const result = await pool.query(
      "SELECT is_verified, verification_token FROM users WHERE email = $1",
      [normalizedEmail(req.body.email)]
    );
    if (!result.rows.length) return res.status(404).json({ message: "User not found." });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error("Test user state error:", err.message);
    return res.status(500).json({ message: "Unable to retrieve test user state." });
  }
};
