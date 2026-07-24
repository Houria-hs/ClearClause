import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import AskClearClause from "../components/AskClearClause";
import { API_URL } from "../config/api";

export default function AskClearClausePage() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const loadDocument = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please log in to access this document.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const { data } = await axios.get(`${API_URL}/api/documents/${documentId}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setDocument(data);
      } catch (requestError) {
        if (!controller.signal.aborted && requestError.code !== "ERR_CANCELED") {
          setError(requestError.response?.data?.error || "We could not load this document.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadDocument();
    return () => controller.abort();
  }, [documentId]);

  return (
    <main className="min-h-screen bg-[#F7FAFF] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <button type="button" onClick={() => navigate("/analyze")} className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#0057B8] transition hover:bg-blue-50">
          <span aria-hidden="true">←</span> Back to Analysis
        </button>

        <section className="rounded-[2rem] border border-[#D9EAFE] bg-white p-6 shadow-[0_18px_50px_rgba(0,87,184,0.08)] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0057B8]">Document intelligence</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">Ask ClearClause</h1>
          {loading && <p className="mt-4 text-sm text-[#5B6472]">Loading your secure document workspace…</p>}
          {error && <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{error}</p>
            {!localStorage.getItem("token") && <button type="button" onClick={() => navigate("/login")} className="mt-3 font-bold text-[#0057B8] underline">Go to login</button>}
          </div>}
          {document && <>
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[#E4EEF9] bg-[#F5F9FF] px-4 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D9EAFE] text-lg" aria-hidden="true">⌁</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#111827]">{document.filename}</p>
                <p className="text-xs text-[#5B6472]">Private document workspace · Answers cite the document where possible</p>
              </div>
            </div>
            <AskClearClause key={document.id} documentId={document.id} filename={document.filename} chunks={document.analysis} showHeader={false} />
          </>}
        </section>
      </div>
    </main>
  );
}
