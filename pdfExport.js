// Lazy-loaded PDF export module (loads jsPDF / html2pdf.js from CDN only on demand)

const JSPDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const HTML2PDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";

const scriptPromises = new Map();

function loadScriptOnce(src) {
  if (scriptPromises.has(src)) {
    return scriptPromises.get(src);
  }

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromises.delete(src);
      script.remove();
      reject(new Error(`Failed to load script: ${src}`));
    };
    document.head.appendChild(script);
  });

  scriptPromises.set(src, promise);
  return promise;
}

export async function generatePDFReport() {
  if (!window.jspdf?.jsPDF) {
    await loadScriptOnce(JSPDF_CDN);
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = 15;
  const lineHeight = 7;
  const wrap = (text, max) => doc.splitTextToSize(text, max || 180);

  const now = new Date().toLocaleString();
  const tip = document.getElementById("ai-tip-text")?.innerText || "";
  const getVal = id => document.getElementById(id)?.value || "–";

  const sliders = [
    ["Total Budget (€)", "total_budget"],
    ["Node Server", "C_node_server"],
    ["Node Infra", "C_node_infra"],
    ["Facility", "C_node_facility"],
    ["Software", "C_software"],
    ["Electricity (€/kWh)", "C_electricity"],
    ["PUE", "C_PUE"],
    ["System Usage (hrs/year)", "system_usage"],
    ["Lifetime (yrs)", "lifetime"],
    ["Baseline Power (W)", "W_node_baseline"],
    ["Depreciation", "C_depreciation"],
    ["Subscription", "C_subscription"],
    ["Inefficiency", "C_uefficiency"],
    ["Heat Revenue/kWh", "C_heatreuseperkWh"],
    ["Heat Reuse Factor", "Factor_heatreuse"],
    ["Maintenance", "C_maintenance"]
  ];

  const addHeader = (title) => {
    doc.setFontSize(14);
    doc.text(title, 15, y);
    y += lineHeight;
    doc.setFontSize(11);
  };

  const checkPage = () => {
    if (y > 275) {
      doc.addPage();
      y = 15;
    }
  };

  // --- Title
  doc.setFontSize(16);
  doc.text("Work-per-TCO Report", 15, y);
  y += lineHeight;
  doc.setFontSize(10);
  doc.text(`Generated: ${now}`, 15, y);
  y += lineHeight;

  // --- Section 1: Inputs
  addHeader("1. Input Parameters");
  sliders.forEach(([label, id]) => {
    checkPage();
    doc.text(`${label}: ${getVal(id)}`, 15, y);
    y += lineHeight;
  });

  // --- Section 2: Summary
  y += 5;
  checkPage();
  addHeader("2. Calculation Summary");

  const best = window.bestResult;
  if (best) {
    doc.text(`Best GPU: ${best.name}`, 15, y);
    y += lineHeight;
    doc.text(`Work-per-TCO: ${best.perf_per_tco.toExponential(3)} ns/€ * atoms`, 15, y);
    y += lineHeight;
  } else {
    doc.text("No calculation result found. Please calculate before exporting.", 15, y);
    y += lineHeight;
  }

  // --- Section 3: AI Tip
  y += 5;
  checkPage();
  addHeader("3. Smart Strategy Tip");
  const tipLines = wrap(tip);
  tipLines.forEach(line => {
    doc.text(line, 15, y);
    y += lineHeight;
  });

  // --- Footer
  y += 10;
  doc.setFontSize(8);
  doc.text("Generated using Wattlytics Calculator – © 2025 Ayesha Afzal <mailto:ayesha.afzal@fau.de>, NHR@HPC, FAU Erlangen-Nürnberg", 15, 285);

  // --- Save
  doc.save(`Wattlytics_Report_${now.replace(/[^\d]/g, "_")}.pdf`);
}

export async function downloadComparisonPDF() {
  const element = document.getElementById("scenario-comparison");

  if (!element || !element.innerHTML.trim()) {
    alert("❗ Please compare scenarios first!");
    return;
  }

  if (typeof window.html2pdf !== "function") {
    await loadScriptOnce(HTML2PDF_CDN);
  }

  const opt = {
    margin:      0.5,
    filename:    "scenario_comparison.pdf",
    image:       { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF:       { unit: "in", format: "letter", orientation: "portrait" }
  };

  window.html2pdf().set(opt).from(element).save();
}
