import { useState, useEffect } from "react";
import loadingicon from "../assets/loading.png"
import PremiumButton from "./PremiumBtn";
import uploadIcon from "../assets/Frame.png"
import axios from "axios";
import { useNavigate } from "react-router-dom"; 
import { pdf } from '@react-pdf/renderer';
import { ResultExport } from "./ResultExport";
import { API_URL } from "../config/api";

export default function PdfRiskAnalyzer() {
  const [file, setFile] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [documentId, setDocumentId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [step, setStep] = useState("upload");
  const [user, setUser] = useState(null);
  const [showGreeting, setShowGreeting] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);

useEffect(() => {
  if (step === "scanning") {
    // 1. Start moving the bar
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 60) return prev + 2;     // Fast at first
        if (prev < 90) return prev + 0.5;   // Slow down for "deep analysis"
        if (prev < 98) return prev + 0.1;   // "Finalizing..."
        return prev;
      });
    }, 100);

    return () => clearInterval(interval);
  }
}, [step]);

// When chunks arrive from your API, set progress to 100 immediately
useEffect(() => {
  if (chunks && chunks.length > 0) {
    setProgress(100);
  }
}, [chunks]);

const resetAnalyzer = () => {
  setFile(null);
  setUploadProgress(0);
  setChunks([]);
  setDocumentId(null);
  setError("");
  setStep("upload");
};

useEffect(() => {
  const initUser = async () => {
    const token = localStorage.getItem("token");
    const savedName = localStorage.getItem("userName");

    if (token) {
      try {
        const { data } = await axios.get(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        setUser({
          ...data,
          username: savedName || data.username 
        });

        return; 
      } catch (err) {
        console.error("Token invalid");
        localStorage.removeItem("token");
      }
    }

    if (savedName) {
      setUser({ username: savedName });
    }
  };

  initUser();
}, []); 

useEffect(() => {
  if (uploadProgress === 100 && file && step === "upload") {
    // Small delay so the user can see 100% before it switches
    const timer = setTimeout(() => {
      handleUpload();
    }, 500);
    return () => clearTimeout(timer);
  }
}, [uploadProgress, file, step]);

// automatic upload
const handleUpload = async () => {
  if (!file) return; 

  try {
    setLoading(true);
    setStep("scanning"); 
    
    const formData = new FormData();
    formData.append("pdf", file);

    const token = localStorage.getItem("token");
    const { data } = await axios.post(`${API_URL}/api/pdf/upload`, formData, { headers: { Authorization: `Bearer ${token}` } });
    setDocumentId(data.documentId);
    
    // Pass chunks to analysis
    await handleAnalyze(data.chunks, data.documentId);
    
  } catch (err) {
    const errorMsg = err.response?.data?.error || "Analysis failed. Please try again.";
    setStep("upload");
    setError(errorMsg);
    setError("Analysis failed. Please enter a valid document format.");
    setUploadProgress(0); 
  } finally {
    setLoading(false);
  }
};

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setUploadProgress(0);

    setUploadProgress(100);
  };


  const handleAnalyze = async (chunksData, currentDocumentId = documentId) => {
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(`${API_URL}/api/pdf/analyze`, { chunks: chunksData, documentId: currentDocumentId }, { headers: { Authorization: `Bearer ${token}` } });
      // Check if Gemini rejected it as a non-legal document
    if (data.analyzedChunks[0]?.is_legal === false) {
       setError(data.analyzedChunks[0].error);
       setStep("upload");
       return;
    }
      
      setChunks(data.analyzedChunks);
      setStep("result");
      
  } catch {
      setError("Failed to analyze content.");
      setStep("upload");
    }
  };


useEffect(() => {
  if (error) {
    const timer = setTimeout(() => {
      setError("");
    }, 5000); // Disappears after 5 seconds
    return () => clearTimeout(timer);
  }
}, [error]);

const handleDownload = async () => {
  const riskyChunks = chunks.filter(c => c.risk && c.risk !== "Low");
  if (riskyChunks.length === 0) return alert("No risky clauses found.");

  const blob = await pdf(<ResultExport chunks={riskyChunks} fileName={file?.name} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${file?.name.split('.')[0]}_Analysis.pdf`;
  link.click();
};


const handleLogout = () => {
  console.log("Logging out..."); // Check if this shows in your console
  
  // Clear everything
  localStorage.clear(); 
  
  if (typeof setUser === "function") {
    setUser(null);
  }

  setIsMenuOpen(false);

  // Force navigate to register
  setTimeout(() => {
    navigate("/register");
  }, 10);
};

  const compromised = chunks.some((c) => c.risk === "High");


  return (
    <div className="min-h-screen flex justify-center items-center bg-slate-50 sm:py-10 font-['Sora']">
      <div className="w-full max-w-md lg:max-w-2xl bg-white min-h-screen sm:min-h-[850px] sm:rounded-[3rem] sm:shadow-2xl relative overflow-hidden flex flex-col border border-gray-100">
        {step === "upload" && (
        <div className="px-6 lg:px-10 pt-12 pb-4 flex justify-between items-center">
          {/* left side */}
          <div className="flex flex-col items-start space-y-0.5">
            <p className="text-[13px] lg:text-[17px] font-['Sora'] text-[#000000] font-bold-400 font-medium leading-none mb-2">
              Welcome!
            </p>
            <h2 className="text-[15px] lg:text-[17px] font-bold text-[#000000] capitalize leading-tight tracking-tight">
              {user?.username || "Guest"} 👋  
            </h2>
          </div>
        
          {/* right side: menu button */}
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="bg-[#0000000A]  p-2.5 rounded-full active:scale-90 transition-transform">
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
                )}            </svg>
          </button>
        </div>
        )}

        {/* MOBILE MENU DROPDOWN */}
        {isMenuOpen && (
          <>
            <div 
              className="fixed inset-0 z-[50] lg:hidden" 
              onClick={() => setIsMenuOpen(false)} 
            />

            {/* Floating Menu Card */}
            <div className="absolute right-6 top-24 w-56 bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-50 z-[55]  animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 origin-top-right">
              <div className="p-2 flex flex-col">
                
                {/* Navigation Links */}
                <button onClick={() => { navigate("/Onboarding"); setIsMenuOpen(false); }} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 rounded-2xl transition-colors text-gray-700 active:bg-blue-50">
                  <span className="text-lg">👋</span>
                  <span className="text-[14px] font-bold font-['Sora']">Go back</span>
                </button>

                {/* Divider */}
                <div className="h-[1px] bg-gray-100 my-1 mx-2"></div>

                {/* Logout Button */}
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 rounded-2xl transition-colors text-red-500 active:bg-red-100"
                >
                  <span className="text-lg">🚪</span>
                  <span className="text-[14px] font-bold font-['Sora']">Logout</span>
                </button>
              </div>
            </div>
          </>
        )}

        <div className="px-6 lg:px-12 flex-1 flex flex-col relative" style={{marginTop:'3rem'}}>
          {/* UPLOAD SCREEN */}
          {step === "upload" && (
            <div className="animate-in fade-in duration-500">

              <div className="h-10 mb-4">
                  {error && (
                    <div className="animate-toast bg-red-50 text-red-600 text-[12px] lg:text-[18px] p-2 rounded-lg text-center font-medium border border-red-100">
                      ⚠️ {error}
                    </div>
                  )}
               </div>

              <h1 className="text-[18px]lg:text-[24px] font-normal text-start text-[#000000] leading-[26px] mb-3">
                Clear Clause your Legal AI Companion
              </h1>
              <p className="text-[#696969] text-start text-[14px] lg:text-[16px] leading-relaxed">
                Upload your legal document to scan for little errors and mistake
              </p>

              {/* UPLOAD BOX */}
              <div className="mt-8 bg-[#c5e3ff] rounded-3xl p-5 border border-blue-50">
                <p className="text-[#0073FF] font-['Sora'] text-[12px] line-height[21px] text-start mb-4 lg:text-[16px] ">Upload a document</p>
                
                <label className="cursor-pointer  block bg-white p-[7px] rounded-[10px]">
                  <div className="bg-white/50 py-12 px-6 lg:p-16 min-h-[200px] lg:min-h-0  border-[1px] border-dashed border-[#E9E9E9] rounded-[10px] p-[10px] flex flex-col items-center justify-center">
                    <div className="flex text-center flex-col items-center justify-center ">
                      <img src={uploadIcon} alt="icon" />
                      {/* <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg> */}
                    <p className="text-[12px] text-[#000000]font-bold-400 font-['Sora'] lg:text-[16px]">Drag and drop or <span className="text-[#0073FF] underline ">choose file</span> to upload.</p>
                    <p className="text-[12px] text-[#000000] mt-1 font-['Sora'] lg:text-[16px]">File format: PDF, Max 5.0MB</p>
                    </div>
                  </div>
                  <input type="file" accept="application/pdf, 
                    application/vnd.openxmlformats-officedocument.wordprocessingml.document, 
                    image/png, 
                    image/jpeg" 
                    onChange={handleFileChange} 
                    className="hidden" />
                </label>
                {file && (
  <div className="mt-6 bg-white rounded-2xl p-4 lg:p-5 flex items-center gap-4 shadow-md relative animate-in fade-in slide-in-from-top-2">
    {/* 1. LARGER FILE ICON */}
    <div className={`shrink-0 h-12 w-12 flex items-center justify-center rounded-xl text-white text-[11px] font-bold shadow-sm ${
      file.type.includes('pdf') ? 'bg-red-500' : 
      file.type.includes('image') ? 'bg-purple-500' : 'bg-blue-500'
    }`}>
      {file.name.split('.').pop().toUpperCase()}
    </div>

    {/* 2. FLEXIBLE CONTENT AREA */}
    <div className="flex-1 min-w-0"> {/* min-w-0 prevents text from breaking flexbox */}
      <div className="flex justify-between items-center mb-2">
        <p className="text-[12px] lg:text-[14px] font-bold text-gray-800 truncate pr-2">
          {file.name}
        </p>
        <p className="text-[11px] font-semibold text-[#0073FF]">
          {uploadProgress}%
        </p>
      </div>

      {/* 3. THICKER PROGRESS BAR */}
      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden shadow-inner">
        <div 
          className="bg-[#00ABFF] h-full transition-all duration-500 ease-out" 
          style={{ width: `${uploadProgress}%` }}
        ></div>
      </div>

      <p className="text-[10px] text-start text-gray-400 font-['Sora'] mt-2">
        {(file.size / 1024).toFixed(1)} KB of 5.0 MB
      </p>
    </div>

    {/* 4. SPACED REMOVE BUTTON */}
    <button 
      onClick={() => setFile(null)} 
      className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
      aria-label="Remove file"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
                )}
              </div>
            </div>
          )}
         {/* SCANNING STATE */}
          {step === "scanning" && (
            <div className="flex-1 flex flex-col items-center justify-center px-10 text-center animate-in fade-in duration-700">
    
              <div className="relative mb-8 lg:mb-12 group">
                {/* Pulse effect */}
                <div className="absolute inset-0 rounded-full bg-blue-400/10 animate-ping duration-[3000ms]"></div>
          
                {/* The Loading Icon */}
                <div className="relative z-10 p-10 lg:p-16 bg-white rounded-full shadow-2xl overflow-hidden border border-gray-50">
                  <img 
                    src={loadingicon} 
                    alt="Scanning..." 
                    className="w-20 h-20 lg:w-32 lg:h-32 object-contain" 
                  />

                  <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-[#0073FF] to-transparent shadow-[0_0_20px_#0073FF] animate-[scan_2s_ease-in-out_infinite]"></div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[20px] font-bold text-black font-['Sora']">
                  {progress < 100 ? "AI Analysis in Progress..." : "Analysis Complete!"}
                </h3>
                <p className="text-[14px]  lg:text-[16px] text-gray-500 font-['Sora'] h-5">
                  {progress < 40 && "Reading document structure..."}
                  {progress >= 40 && progress < 80 && "Scanning for risky clauses..."}
                  {progress >= 80 && progress < 100 && "Generating risk report..."}
                  {progress === 100 && "Success!"}
                </p>
              </div>

               {/* CONTROLLED PROGRESS BAR */}
              <div className="mt-10 w-full max-w-[280px] h-2 bg-gray-100 rounded-full overflow-hidden relative border border-gray-50 shadow-inner">
                <div 
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#00ABFF] to-[#0073FF] rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${progress}%` }}
                >
                  {/* Reflection shimmer on the bar itself */}
                  <div className="absolute inset-0 bg-white/20 animate-[shimmer_1.5s_infinite]"></div>
                </div>
              </div>

              <p className="mt-4 text-[12px] font-bold text-[#0073FF] font-['Sora']">
                {Math.round(progress)}%
              </p>

              <style dangerouslySetInnerHTML={{ __html: `
                @keyframes scan {
                  0%, 100% { transform: translateY(0); opacity: 0; }
                  50% { transform: translateY(180px); opacity: 1; }
                }
                @keyframes shimmer {
                  0% { transform: translateX(-100%); }
                  100% { transform: translateX(100%); }
                }
              `}} />
            </div>
          )}
          {/* RESULT SCREEN */}
          {step === "result" && (
            <div className="animate-in slide-in-from-bottom-6 duration-700  pb-10 h-full flex flex-col">
              <div className="flex items-center gap-2 p-4 mb-6 rounded-2xl border border-gray-100 bg-white shadow-sm mt-4">
                <div className={`p-2 rounded-lg ${compromised ? "bg-red-50 text-red-500" : "bg-green-50 text-green-500"}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <p className="text-[13px] font-['Sora'] font-medium text-gray-800">
                  Document Integrity - <span className={compromised ? "text-red-500 font-bold" : "text-green-500 font-bold"}>
                    {compromised ? "Compromised" : "Secure"}
                  </span>
                </p>
              </div>

             {/*  DATA RESULTS */}
            <div className="bg-white rounded-[40px] lg:p-10 p-8 shadow-sm border border-gray-50 mb-6 overflow-hidden min-h-[400px]">
              <h3 className="text-[14px] font-bold text-gray-800 text-center mb-8">
                  {file ? file.name.replace(/\.[^/.]+$/, "") : "Document Analysis"}
              </h3>
              <div className="space-y-6">
                {chunks.map((c, i) => (
                  <div key={i} className="relative pl-4">
                    {/* Visual Bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-full ${
                      c.risk === 'High' ? 'bg-red-500' : 
                      c.risk === 'Medium' ? 'bg-orange-500' : 'bg-green-500'
                    }`} />

                    <p className="text-[10px] leading-relaxed text-gray-600 font-medium">
                      {c.text}
                    </p>
      
                    <p className={`text-[9px] font-['Sora'] mt-1 italic ${
                      c.risk === 'High' ? 'text-red-500' : 
                      c.risk === 'Medium' ? 'text-orange-400' : 'text-green-500'
                    }`}>
                      {c.risk} Risk: {c.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
                        
              {/* Color Code */}
              <div className="flex flex-wrap justify-between items-center  gap-y-4 px-2 mb-6">
                <div className="flex  items-center gap-2 m-2">
                  <div className="w-4 h-4 bg-green-500 rounded-[2px]"></div>
                  <span className="text-[12px] font-['Sora'] font-bold text-green-600">Secure</span>
                </div>
                <div className="flex items-center gap-2 ">
                  <div className="w-4 h-4 bg-orange-500 rounded-[2px]"></div>
                  <span className="text-[12px] font-['Sora'] font-bold text-orange-600">Reviewed</span>
                </div>
                <div className="flex items-center gap-2 m-2">
                  <div className="w-4 h-4 bg-red-500 rounded-[2px]"></div>
                  <span className="text-[12px] font-['Sora'] font-bold text-red-600">Compromised</span>
                </div>
              </div>

              <div className="bg-[#E0E0E052] rounded-[10px] p-4 mb-8">
                <p className="text-[#383838] text-[14px] text-center font-normal font-['Sora'] leading-[21px]">
                  This color code identify your document quality
                </p>
              </div>

            <PremiumButton 
                text="Download Review" 
                onClick={handleDownload} 
            />

            {documentId && <div className="mt-4">
              <PremiumButton
                text="Ask ClearClause"
                onClick={() => navigate(`/ask-clearclause/${documentId}`)}
              />
            </div>}

            <h4 
            onClick={resetAnalyzer}
            className="text-xm text-center font-['Sora'] mt-6 mb-4 cursor-pointer text-[#0073FF]">
              Scan Again
            </h4>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
