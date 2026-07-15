import { CLASS_LABELS, RISK_LABEL, RISK_STYLES } from "../classes";

function findNearbyDermatology() {
  const openMaps = (query) => window.open(`https://www.google.com/maps/search/${query}`, "_blank");
  if (!navigator.geolocation) {
    openMaps("dermatology clinic");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => openMaps(`dermatology clinic/@${pos.coords.latitude},${pos.coords.longitude},14z`),
    () => openMaps("dermatology clinic")
  );
}

export default function ResultPanel({ result, onDownloadReport, reportStatus }) {
  const style = RISK_STYLES[result.risk_level] ?? RISK_STYLES.medium;
  const sortedProbs = Object.entries(result.probabilities).sort((a, b) => b[1] - a[1]);

  return (
    <section className={`bg-white rounded-2xl shadow-sm border border-slate-200 ring-4 ${style.ring} p-6 space-y-6`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-slate-500">Prediction</p>
          <p className="text-2xl font-bold text-slate-900">{result.label}</p>
        </div>
        <span className={`px-4 py-2 rounded-full text-sm font-semibold ${style.badge}`}>
          {RISK_LABEL[result.risk_level]} · Confidence {(result.confidence * 100).toFixed(1)}%
        </span>
      </div>

      {result.risk_upgraded_low_confidence && (
        <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          Prediction confidence is low, so the risk level was raised as a precaution.
        </p>
      )}

      {result.quality_warnings.length > 0 && (
        <div className="space-y-1">
          {result.quality_warnings.map((w, i) => (
            <p key={i} className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              ⚠️ {w}
            </p>
          ))}
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Class probabilities</h3>
        <div className="space-y-2">
          {sortedProbs.map(([code, prob]) => (
            <div key={code}>
              <div className="flex justify-between text-xs text-slate-500 mb-0.5">
                <span>{CLASS_LABELS[code]}</span>
                <span>{(prob * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full ${style.bar}`} style={{ width: `${prob * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-sm text-slate-600">{result.guidance}</p>

      <div className="flex flex-wrap gap-3">
        {result.risk_level === "high" && (
          <button
            onClick={findNearbyDermatology}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition"
          >
            Find nearby dermatology clinics
          </button>
        )}
        <button
          onClick={onDownloadReport}
          disabled={reportStatus === "loading"}
          className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-sm font-medium rounded-lg px-4 py-2 transition"
        >
          {reportStatus === "loading" ? "Generating report..." : "Download PDF report"}
        </button>
      </div>
    </section>
  );
}
