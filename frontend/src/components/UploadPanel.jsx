export default function UploadPanel({ previewUrl, onFileChange, onAnalyze, status }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
      <label className="block">
        <span className="text-sm font-semibold text-slate-700">Upload a skin lesion photo</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-medium hover:file:bg-indigo-100"
        />
      </label>

      {previewUrl && (
        <img
          src={previewUrl}
          alt="Uploaded lesion preview"
          className="max-h-72 rounded-lg border border-slate-200 object-contain mx-auto"
        />
      )}

      {status === "error" && (
        <p className="text-sm text-red-600">Something went wrong while analyzing. Please try again.</p>
      )}

      <button
        onClick={onAnalyze}
        disabled={!previewUrl || status === "loading"}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-lg py-3 transition"
      >
        {status === "loading" ? "Analyzing..." : "Analyze"}
      </button>
    </section>
  );
}
