import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import PremiumButton from "../components/PremiumBtn";
import { API_URL } from "../config/api";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const sideLabel = { A: "Contract A", B: "Contract B", Neither: "Neither contract" };
const fileSize = (size) => `${(size / 1024 / 1024).toFixed(2)} MB`;

function ContractUploadCard({ label, file, onChange, onRemove }) {
  const inputRef = useRef(null);
  const side = label.endsWith("A") ? "A" : "B";
  const chooseFile = (event) => onChange(event.target.files?.[0] || null);
  const dropFile = (event) => {
    event.preventDefault();
    onChange(event.dataTransfer.files?.[0] || null);
  };

  return (
    <section className="group min-w-0 rounded-[1.75rem] border border-[#D7E6F8] bg-white p-4 shadow-[0_12px_35px_rgba(17,24,39,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-[#9BC8F6] hover:shadow-[0_18px_42px_rgba(0,87,184,0.10)] sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0057B8]">{label}</p><h2 className="mt-1 truncate text-lg font-bold text-[#111827]">{file ? "Ready to compare" : `Add ${label}`}</h2></div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-sm font-bold text-[#D4AF37] shadow-sm" aria-hidden="true">{side}</span>
      </div>

      {file ? (
        <div className="mt-5 rounded-2xl border border-[#DDEAF8] bg-[#F8FBFF] p-4">
          <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0057B8] text-xs font-bold text-white">PDF</span><div className="min-w-0"><p className="truncate text-sm font-bold text-[#111827]" title={file.name}>{file.name}</p><p className="mt-0.5 text-xs text-[#5B6472]">PDF document - {fileSize(file.size)}</p></div></div>
          <div className="mt-4 flex gap-4 border-t border-[#E4EEF9] pt-3"><button type="button" onClick={() => inputRef.current?.click()} className="rounded-lg text-sm font-bold text-[#0057B8] outline-none focus-visible:ring-2 focus-visible:ring-[#0057B8]">Replace</button><button type="button" onClick={onRemove} className="rounded-lg text-sm font-bold text-[#9F1239] outline-none focus-visible:ring-2 focus-visible:ring-[#9F1239]">Remove</button></div>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={dropFile} className="mt-5 flex min-h-44 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[#B9D5F1] bg-[#F8FBFF] px-5 text-center outline-none transition hover:border-[#0057B8] hover:bg-[#F1F7FE] focus-visible:ring-2 focus-visible:ring-[#0057B8]">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl font-bold text-[#0057B8] shadow-sm" aria-hidden="true">+</span><span className="mt-3 text-sm font-bold text-[#111827]">Choose a PDF contract</span><span className="mt-1 text-xs text-[#5B6472]">Drag and drop, or browse files</span><span className="mt-3 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#5B6472]">PDF - Up to 10 MB</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label={label} onChange={chooseFile} />
    </section>
  );
}

function ListCard({ title, items, tone = "blue" }) {
  const styles = tone === "gold" ? "border-[#EAD9A4] bg-[#FFFDF6]" : "border-[#D7E6F8] bg-white";
  return <article className={`min-w-0 rounded-2xl border p-5 ${styles}`}><h2 className="text-sm font-bold text-[#111827]">{title}</h2>{items.length ? <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#4B5563]">{items.map((item, index) => <li key={index} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0057B8]" /><span>{item}</span></li>)}</ul> : <p className="mt-3 text-sm leading-relaxed text-[#5B6472]">No specific advantages were identified in the analyzed clauses.</p>}</article>;
}

function SourceReferences({ item }) {
  const references = [...(item.contractA.sourceReferences || []), ...(item.contractB.sourceReferences || [])];
  if (!references.length) return null;
  return <details className="mt-4 border-t border-[#E4EEF9] pt-3 text-xs text-[#5B6472]"><summary className="cursor-pointer font-bold text-[#0057B8] outline-none focus-visible:ring-2 focus-visible:ring-[#0057B8]">View source excerpts</summary><ul className="mt-3 space-y-2 leading-relaxed">{references.map((reference, index) => <li key={index} className="rounded-lg bg-white px-3 py-2">&quot;{reference}&quot;</li>)}</ul></details>;
}

function ComparisonMobileCard({ item }) {
  return <article className="rounded-2xl border border-[#D7E6F8] bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><h3 className="text-base font-bold text-[#111827]">{item.category}</h3><span className="shrink-0 rounded-full bg-[#F5EBC8] px-2.5 py-1 text-[11px] font-bold text-[#6D5200]">{item.importance} impact</span></div><div className="mt-4 grid gap-3"><div className="rounded-xl bg-[#F5F9FF] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0057B8]">Contract A</p><p className="mt-1.5 text-sm leading-relaxed text-[#374151]">{item.contractA.summary}</p></div><div className="rounded-xl bg-[#FCFAF3] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#806000]">Contract B</p><p className="mt-1.5 text-sm leading-relaxed text-[#374151]">{item.contractB.summary}</p></div></div><div className="mt-4 border-l-2 border-[#D4AF37] pl-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6D5200]">Key difference</p><p className="mt-1 text-sm leading-relaxed text-[#374151]">{item.difference}</p><p className="mt-2 text-xs font-bold text-[#0057B8]">More favorable: {sideLabel[item.moreFavorable]}</p></div><SourceReferences item={item} /></article>;
}

function ComparisonResults({ data, onStartOver }) {
  const { comparison, contractA, contractB } = data;
  const preferred = comparison.overallVerdict.preferredContract;
  const categoryCount = comparison.categories.length;
  const highImpactCount = comparison.categories.filter((item) => item.importance === "high").length;

  return <div className="space-y-6 sm:space-y-8"><header className="rounded-[1.75rem] border border-[#D7E6F8] bg-white px-5 py-5 text-center shadow-sm sm:px-7"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0057B8]">Contract intelligence</p><div className="mt-2"><h1 className="text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">Contract Comparison</h1><p className="mx-auto mt-1 max-w-xl text-sm text-[#5B6472]">A clause-by-clause view of the two uploaded agreements.</p></div><button type="button" onClick={onStartOver} className="mt-4 rounded-xl border border-[#BCD8F4] px-3 py-2 text-sm font-bold text-[#0057B8] outline-none transition hover:bg-[#F5F9FF] focus-visible:ring-2 focus-visible:ring-[#0057B8]">Compare new contracts</button><div className="mt-5 grid gap-3 text-left sm:grid-cols-2"><div className="min-w-0 rounded-xl bg-[#F5F9FF] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0057B8]">Contract A</p><p className="mt-1 truncate text-sm font-bold text-[#111827]" title={contractA.filename}>{contractA.filename}</p></div><div className="min-w-0 rounded-xl bg-[#FCFAF3] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#806000]">Contract B</p><p className="mt-1 truncate text-sm font-bold text-[#111827]" title={contractB.filename}>{contractB.filename}</p></div></div></header>

    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]"><div className="rounded-[1.75rem] bg-[#111827] p-6 text-center text-white shadow-[0_18px_45px_rgba(17,24,39,0.16)] sm:p-7"><div className="flex flex-wrap justify-center gap-3"><span className="rounded-full bg-[#D4AF37] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#111827]">Overall verdict</span><span className="text-xs font-semibold text-slate-300">{comparison.overallVerdict.confidence} confidence</span></div><h2 className="mx-auto mt-4 max-w-2xl text-2xl font-bold leading-tight sm:text-3xl">{sideLabel[preferred]} appears more favorable overall</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-200">{comparison.overallVerdict.summary}</p><p className="mt-4 text-xs text-slate-400">Based only on extracted clauses. ClearClause provides information, not legal advice.</p></div><div className="grid grid-cols-2 gap-3 text-center lg:grid-cols-1"><div className="rounded-2xl border border-[#D7E6F8] bg-white p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5B6472]">Compared</p><p className="mt-2 text-2xl font-bold text-[#111827]">{categoryCount}</p><p className="text-xs text-[#5B6472]">clause categories</p></div><div className="rounded-2xl border border-[#EAD9A4] bg-[#FFFDF6] p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#806000]">Priority review</p><p className="mt-2 text-2xl font-bold text-[#111827]">{highImpactCount}</p><p className="text-xs text-[#5B6472]">high-impact differences</p></div></div></section>

    <section><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0057B8]">Clause comparison</p><h2 className="mt-1 text-xl font-bold text-[#111827]">Where the contracts differ</h2></div><p className="text-sm text-[#5B6472]">Only identified categories are included.</p></div><div className="mt-5 hidden overflow-hidden rounded-2xl border border-[#D7E6F8] bg-white shadow-sm md:block"><div className="grid grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 bg-[#F5F9FF] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#5B6472]"><span>Category</span><span>Contract A</span><span>Contract B</span><span>Key difference</span></div>{comparison.categories.map((item, index) => <article key={`${item.category}-${index}`} className="grid grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 border-t border-[#E7EFF8] px-5 py-5 text-sm"><div><h3 className="font-bold text-[#111827]">{item.category}</h3><span className="mt-2 inline-block rounded-full bg-[#F5EBC8] px-2 py-1 text-[10px] font-bold text-[#6D5200]">{item.importance} impact</span></div><p className="min-w-0 break-words leading-relaxed text-[#374151]">{item.contractA.summary}</p><p className="min-w-0 break-words leading-relaxed text-[#374151]">{item.contractB.summary}</p><div className="min-w-0"><p className="break-words leading-relaxed text-[#374151]">{item.difference}</p><p className="mt-2 text-xs font-bold text-[#0057B8]">Favors: {sideLabel[item.moreFavorable]}</p></div></article>)}</div><div className="mt-5 grid gap-4 md:hidden">{comparison.categories.map((item, index) => <ComparisonMobileCard key={`${item.category}-mobile-${index}`} item={item} />)}</div></section>

    <section><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0057B8]">Balanced assessment</p><h2 className="mt-1 text-xl font-bold text-[#111827]">Advantages and tradeoffs</h2><div className="mt-5 grid gap-4 lg:grid-cols-3"><ListCard title="Contract A advantages" items={comparison.contractAAdvantages} /><ListCard title="Contract B advantages" items={comparison.contractBAdvantages} /><ListCard title="Important tradeoffs" items={comparison.tradeoffs} tone="gold" /></div></section>
  </div>;
}

export default function CompareContractsPage() {
  const navigate = useNavigate();
  const [contractA, setContractA] = useState(null);
  const [contractB, setContractB] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const requestRef = useRef(null);

  useEffect(() => {
    if (!localStorage.getItem("token")) navigate("/login", { replace: true });
    return () => requestRef.current?.abort();
  }, [navigate]);

  const selectFile = (setFile) => (file) => {
    setError("");
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return setError("Please choose a PDF file for each contract.");
    if (file.size > MAX_FILE_SIZE) return setError("Each contract must be 10 MB or smaller.");
    setFile(file);
  };
  const compare = async () => {
    if (!contractA || !contractB) return setError("Upload both Contract A and Contract B before comparing.");
    setError(""); setLoading(true);
    const controller = new AbortController(); requestRef.current = controller;
    const formData = new FormData(); formData.append("contractA", contractA); formData.append("contractB", contractB);
    try {
      const { data } = await axios.post(`${API_URL}/api/compare`, formData, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, signal: controller.signal });
      if (!controller.signal.aborted) setResult(data);
    } catch (requestError) {
      if (requestError.response?.status === 401) navigate("/login", { replace: true });
      else if (requestError.code !== "ERR_CANCELED") setError(requestError.response?.data?.error || "Unable to compare the contracts right now.");
    } finally { if (requestRef.current === controller) { requestRef.current = null; setLoading(false); } }
  };
  const reset = () => { setResult(null); setContractA(null); setContractB(null); setError(""); };

  return <main className="min-h-screen overflow-x-hidden bg-[#F7FAFF] px-4 py-5 font-['Sora'] sm:px-6 sm:py-8 lg:px-10 lg:py-10"><div className="mx-auto w-full max-w-6xl"><button type="button" onClick={() => navigate("/analyze")} className="mb-5 inline-flex rounded-xl px-3 py-2 text-sm font-bold text-[#0057B8] outline-none transition hover:bg-[#EAF4FE] focus-visible:ring-2 focus-visible:ring-[#0057B8]">Back to Analysis</button>{result ? <ComparisonResults data={result} onStartOver={reset} /> : <section className="rounded-[2rem] border border-[#D7E6F8] bg-white p-5 shadow-[0_18px_55px_rgba(17,24,39,0.06)] sm:p-8"><header className="mx-auto max-w-3xl text-center"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0057B8]">Document intelligence</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">Compare Contracts</h1><p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[#5B6472]">Upload two agreements to see the material clause differences, tradeoffs, and a balanced AI-supported assessment grounded in the actual contract text.</p></header><div className="relative mt-8 grid gap-4 md:grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] md:items-stretch"><ContractUploadCard label="Contract A" file={contractA} onChange={selectFile(setContractA)} onRemove={() => setContractA(null)} /><div className="flex items-center justify-center"><span className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-[#F7FAFF] bg-[#111827] text-xs font-bold tracking-[0.14em] text-[#D4AF37] shadow-sm">VS</span></div><ContractUploadCard label="Contract B" file={contractB} onChange={selectFile(setContractB)} onRemove={() => setContractB(null)} /></div>{error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-700">{error}</p>}<div className="mx-auto mt-7 max-w-md"><PremiumButton text={loading ? "Comparing contracts..." : "Compare Contracts"} onClick={compare} disabled={!contractA || !contractB || loading} className={!contractA || !contractB || loading ? "pointer-events-none" : ""} /></div>{loading && <p role="status" className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-[#0057B8]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#D4AF37]" />Extracting clauses and comparing the contracts...</p>}<p className="mx-auto mt-6 max-w-2xl border-t border-[#E7EFF8] pt-5 text-center text-xs leading-relaxed text-[#5B6472]">Your source files are deleted after processing. ClearClause provides an informational comparison, not legal advice. Consider consulting a qualified legal professional before signing.</p></section>}</div></main>;
}
