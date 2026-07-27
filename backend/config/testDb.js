// Test-only in-memory adapter. It is loaded exclusively when NODE_ENV=test,
// allowing end-to-end auth tests to exercise the HTTP flow without touching a
// developer's or production database.
const users = [];
const documents = [];
let nextId = 1;

const result = (rows = []) => ({ rows, rowCount: rows.length });

exports.query = async (sql, params = []) => {
  const query = sql.replace(/\s+/g, " ").trim().toLowerCase();

  if (query === "select 1") return result([{ "?column?": 1 }]);

  if (query.startsWith("select id from users where email")) {
    const user = users.find((item) => item.email === params[0]);
    return result(user ? [{ id: user.id }] : []);
  }
  if (query.startsWith("insert into users")) {
    const [username, email, password, verificationToken] = params;
    const user = { id: nextId++, username, email, password, is_verified: false, verification_token: verificationToken, has_onboarded: false };
    users.push(user);
    return result([{ id: user.id }]);
  }
  if (query.startsWith("delete from users where id")) {
    const index = users.findIndex((item) => item.id === params[0]);
    if (index >= 0) users.splice(index, 1);
    return result();
  }
  if (query.startsWith("select * from users where email")) {
    const user = users.find((item) => item.email === params[0]);
    return result(user ? [{ ...user }] : []);
  }
  if (query.startsWith("update users set is_verified = true") && query.includes("where verification_token")) {
    const user = users.find((item) => item.verification_token === params[0]);
    if (!user) return result();
    user.is_verified = true;
    user.verification_token = null;
    return result([{ id: user.id }]);
  }
  if (query.startsWith("update users set is_verified = true")) {
    const user = users.find((item) => item.id === params[0]);
    if (user) { user.is_verified = true; user.verification_token = null; }
    return result();
  }
  if (query.startsWith("select verification_token from users where email")) {
    const user = users.find((item) => item.email === params[0]);
    return result(user ? [{ verification_token: user.verification_token }] : []);
  }
  if (query.startsWith("select is_verified, verification_token from users where email")) {
    const user = users.find((item) => item.email === params[0]);
    return result(user ? [{ is_verified: user.is_verified, verification_token: user.verification_token }] : []);
  }
  if (query.startsWith("select id, username, email, has_onboarded from users where id")) {
    const user = users.find((item) => item.id === params[0]);
    return result(user ? [{ id: user.id, username: user.username, email: user.email, has_onboarded: user.has_onboarded }] : []);
  }
  if (query.startsWith("update users set has_onboarded = true")) {
    const user = users.find((item) => item.id === params[1]);
    if (user) { user.username = params[0]; user.has_onboarded = true; }
    return result();
  }
  if (query.startsWith("insert into documents")) {
    const [id, userId, filename, mimeType, extractedText] = params;
    documents.push({ id, user_id: userId, filename, mime_type: mimeType, extracted_text: extractedText, analysis: null });
    return result();
  }
  if (query.startsWith("select id from documents where id") && query.includes("user_id")) {
    const document = documents.find((item) => item.id === params[0] && item.user_id === params[1]);
    return result(document ? [{ id: document.id }] : []);
  }
  if (query.startsWith("update documents set analysis")) {
    const document = documents.find((item) => item.id === params[1] && item.user_id === params[2]);
    if (document) document.analysis = typeof params[0] === "string" ? JSON.parse(params[0]) : params[0];
    return result();
  }
  if (query.startsWith("select id, filename, mime_type, analysis from documents")) {
    const document = documents.find((item) => item.id === params[0] && item.user_id === params[1]);
    return result(document ? [{ id: document.id, filename: document.filename, mime_type: document.mime_type, analysis: document.analysis }] : []);
  }
  if (query.startsWith("select id, filename, extracted_text, analysis from documents")) {
    const document = documents.find((item) => item.id === params[0] && item.user_id === params[1]);
    return result(document ? [{ id: document.id, filename: document.filename, extracted_text: document.extracted_text, analysis: document.analysis }] : []);
  }

  throw new Error(`Unhandled test database query: ${query}`);
};
