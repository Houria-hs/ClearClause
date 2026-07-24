import Register from './components/register';
import Login from './components/login';
import './App.css'
import PdfRiskAnalyzer from './components/pdfAnalyzer';
import { useState } from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import WelcomeScreen from './pages/Welcome';
import Onboarding from './pages/Onboarding';
import Terms from './pages/TermsAndServices';
import VerifyEmailPending from './pages/VerifyEmailPending';
import VerifyEmailSuccess from './pages/VerifyEmailSuccess';
import AskClearClausePage from './pages/AskClearClausePage';

function App() {
  const [user, setUser] = useState(null);
 return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WelcomeScreen />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/TermsAndServices" element={<Terms />} />
        <Route path="/analyze" element={<PdfRiskAnalyzer user={user} />} />
        <Route path="/ask-clearclause/:documentId" element={<AskClearClausePage />} />
        <Route path="/Onboarding" element={<Onboarding setUser={setUser} />} />
        <Route path="/verify-email-pending" element={<VerifyEmailPending />} />
        <Route path="/verify-email-success" element={<VerifyEmailSuccess />} />
      </Routes>
     </BrowserRouter>
  );
}

export default App
