import { useState } from "react";
import UploadPanel from "./components/UploadPanel";
import ResultPanel from "./components/ResultPanel";
import { analyzeImage, downloadReport } from "./api";

export default function App() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [reportStatus, setReportStatus] = useState("idle");

  const handleFileChange = (selected) => {
    setFile(selected);
    setResult(null);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setStatus("loading");
    try {
      const data = await analyzeImage(file);
      setResult(data);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  const handleDownloadReport = async () => {
    if (!file) return;
    setReportStatus("loading");
    try {
      const blob = await downloadReport(file);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "skin-analysis-report.pdf";
      a.click();
      URL.revokeObjectURL(url);
      setReportStatus("idle");
    } catch {
      setReportStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-slate-900">🩺 Skin Cancer Detector (Demo)</h1>
          <p className="text-sm text-slate-500 mt-1">
            Upload a photo of a skin lesion and the AI will classify it into one of 7 lesion
            types, with risk-based guidance.
          </p>
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3 font-medium">
            ⚠️ This is a demo service, not a real medical diagnosis. Use the results for
            reference only, and always consult a dermatologist for important decisions.
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <UploadPanel
          previewUrl={previewUrl}
          onFileChange={handleFileChange}
          onAnalyze={handleAnalyze}
          status={status}
        />

        {result && (
          <ResultPanel result={result} onDownloadReport={handleDownloadReport} reportStatus={reportStatus} />
        )}
      </main>

      <footer className="max-w-2xl mx-auto px-4 pb-8 text-xs text-slate-400">
        The classification model behind this service is a demo model trained on synthetic
        data and has not been validated on real clinical data. It cannot replace a medical
        diagnosis.
      </footer>
    </div>
  );
}
