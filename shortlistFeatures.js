/* Course Copilot — Shortlist Comparison, Cost, Deadline & Share */
(function () {
  let showComparison = false;
  let showCostEstimator = false;

  function money(value) {
    const n = Number(value);
    return Number.isFinite(n) ? `$${Math.round(n).toLocaleString()}` : "N/A";
  }

  function courseKey(course) {
    return String(course?.id ?? course?.name ?? "");
  }

  function selectedCourses() {
    if (typeof shortlist === "undefined") return [];
    return shortlist.slice(0, 3);
  }

  function gapText(course) {
    if (typeof explain !== "function") return [];
    return explain(course).gaps || [];
  }

  function valueClass(value, values, lowerIsBetter = false) {
    const clean = values.filter(v => Number.isFinite(Number(v))).map(Number);
    if (!clean.length || !Number.isFinite(Number(value))) return "";
    const best = lowerIsBetter ? Math.min(...clean) : Math.max(...clean);
    return Number(value) === best ? "compare-best" : "";
  }

  function renderComparison() {
    const list = selectedCourses();
    if (!showComparison) return "";
    if (list.length < 2) {
      return `<div class="feature-panel"><strong>Compare courses</strong><div class="mu" style="margin-top:5px">Pin at least 2 courses using ☆ before comparing.</div></div>`;
    }

    const rows = [
      ["University", c => c.uni, false, false],
      ["Country", c => c.country, false, false],
      ["Tuition / year", c => money(c.fee), true, true],
      ["Estimated total cost", c => money(window.CourseCopilotPlanning.estimate(c).total), true, true],
      ["Duration", c => c.duration || c.dur || "N/A", false, false],
      ["Intake", c => Array.isArray(c.intake) ? c.intake.join(", ") : "N/A", false, false],
      ["Min academic score", c => c.minPct != null ? `${c.minPct}%` : "N/A", true, true],
      ["IELTS", c => c.ielts != null ? c.ielts : "N/A", true, true],
      ["Next deadline", c => window.CourseCopilotPlanning.deadlineInfo(c).label, false, false],
      ["Student gaps", c => gapText(c).length ? gapText(c).join(" · ") : "None identified", false, false]
    ];

    return `
      <div class="feature-panel compare-panel">
        <div class="feature-header">
          <div><strong>Side-by-side comparison</strong><div class="mu">Best-value cells are highlighted.</div></div>
          <button class="saved-action" data-feature="compare-close" type="button">Hide</button>
        </div>
        <div class="compare-scroll">
          <table class="compare-table">
            <thead><tr><th>Metric</th>${list.map(c => `<th>${esc(c.name)}<div class="mu">${esc(c.uni)}</div></th>`).join("")}</tr></thead>
            <tbody>
              ${rows.map(([label, getter, numeric, lower]) => {
                const values = numeric ? list.map(c => {
                  if (label === "Estimated total cost") return window.CourseCopilotPlanning.estimate(c).total;
                  if (label === "Min academic score") return Number(c.minPct);
                  if (label === "IELTS") return Number(c.ielts);
                  return Number(c.fee);
                }) : [];
                return `<tr><th>${esc(label)}</th>${list.map(c => `<td class="${valueClass(numeric ? (label === "Estimated total cost" ? window.CourseCopilotPlanning.estimate(c).total : label === "Min academic score" ? Number(c.minPct) : Number(c.ielts)) : null, values, lower)}">${esc(getter(c))}</td>`).join("")}</tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function renderCostEstimator() {
    const list = selectedCourses();
    if (!showCostEstimator) return "";
    if (!list.length) return `<div class="feature-panel"><strong>Total cost</strong><div class="mu">Pin courses first.</div></div>`;
    const estimates = list.map(course => ({ course, estimate: window.CourseCopilotPlanning.estimate(course) }));
    const cheapest = Math.min(...estimates.map(x => x.estimate.total));
    return `
      <div class="feature-panel">
        <div class="feature-header">
          <div><strong>Total cost estimator</strong><div class="mu">Illustrative USD estimates; replace planning assumptions with verified costs.</div></div>
          <button class="saved-action" data-feature="cost-close" type="button">Hide</button>
        </div>
        ${estimates.map(({course, estimate}) => `
          <div class="cost-row ${estimate.total === cheapest ? "cost-best" : ""}">
            <div><strong>${esc(course.name)}</strong><div class="mu">${esc(course.country)} · ${estimate.years} year${estimate.years === 1 ? "" : "s"}</div></div>
            <div class="cost-total">${money(estimate.total)}</div>
          </div>
          <div class="cost-breakdown">
            Tuition ${money(estimate.tuitionTotal)} · Living ${money(estimate.livingTotal)} · Insurance ${money(estimate.insuranceTotal)} · Visa ${money(estimate.visaTotal)}
          </div>
        `).join("")}
        ${estimates.length > 1 ? `<div class="cost-callout">💡 ${esc(estimates.find(x => x.estimate.total === cheapest).course.name)} is the lowest estimated overall cost among the pinned options.</div>` : ""}
      </div>`;
  }

  function featureControls() {
    const count = typeof shortlist === "undefined" ? 0 : shortlist.length;
    return `
      <div class="feature-toolbar">
        <span class="mu">${count} pinned</span>
        <div class="feature-actions">
          <button class="copy-btn" data-feature="compare" type="button">⚖ Compare 2–3</button>
          <button class="copy-btn" data-feature="cost" type="button">💰 Total cost</button>
          <button class="copy-btn" data-feature="share" type="button">↗ Share / PDF</button>
        </div>
      </div>
      ${renderComparison()}
      ${renderCostEstimator()}`;
  }

  function shareHtml() {
    const list = typeof shortlist === "undefined" ? [] : shortlist;
    const student = typeof P !== "undefined" ? P : {};
    const rows = list.map(course => {
      const cost = window.CourseCopilotPlanning.estimate(course);
      const deadline = window.CourseCopilotPlanning.deadlineInfo(course);
      const gaps = gapText(course);
      return `<article><h2>${esc(course.name)}</h2><p><strong>${esc(course.uni)}</strong> · ${esc(course.country)}</p><p>Fee: ${money(course.fee)}/yr · Duration: ${esc(course.duration || course.dur || "N/A")} · Intakes: ${esc((course.intake || []).join(", "))}</p><p><strong>Estimated total cost:</strong> ${money(cost.total)} (${money(cost.tuitionTotal)} tuition + ${money(cost.livingTotal)} living + ${money(cost.insuranceTotal)} insurance + ${money(cost.visaTotal)} visa)</p><p><strong>Next deadline:</strong> ${esc(deadline.label)}</p><p><strong>Fit:</strong> ${gaps.length ? `Gaps: ${esc(gaps.join("; "))}` : "No major gaps identified from the current profile."}</p><p>${esc(course.note || "")}</p></article>`;
    }).join("");
    return `<!doctype html><html><head><meta charset="utf-8"><title>Course Copilot Shortlist</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;color:#1b1f27}h1{margin-bottom:4px}article{border:1px solid #ddd;border-radius:12px;padding:18px;margin:18px 0}small{color:#667085}.meta{color:#667085}.actions{margin:18px 0}.print{border:0;border-radius:8px;padding:9px 14px;background:#2f6df6;color:#fff;font-weight:700;cursor:pointer}@media print{article{break-inside:avoid}.actions{display:none}}</style></head><body><div class="actions"><button class="print" onclick="window.print()">Print / Save as PDF</button></div><h1>Course Copilot — Shortlist</h1><p class="meta">${esc(student.name || "Student")} · Generated ${new Date().toLocaleString()}</p>${rows || "<p>No courses pinned.</p>"}<p><small>Planning costs and deadlines are estimates and should be verified against official university/government sources.</small></p></body></html>`;
  }

  function share() {
    if (typeof shortlist === "undefined" || !shortlist.length) {
      alert("Pin at least one course before sharing.");
      return;
    }
    const html = shareHtml();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (!popup) {
      const a = document.createElement("a");
      a.href = url;
      a.download = "course-copilot-shortlist.html";
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    if (typeof CURRENT_SESSION_ID !== "undefined" && window.CourseCopilotProfileStore) {
      window.CourseCopilotProfileStore.updateSession(CURRENT_SESSION_ID, { shortlistExportedAt: new Date().toISOString() }).catch(() => {});
    }
  }

  function toggleFeature(feature) {
    if (feature === "compare") {
      if (typeof shortlist === "undefined" || shortlist.length < 2) {
        alert("Pin at least 2 courses to compare.");
        return;
      }
      if (shortlist.length > 3) {
        alert("Keep 2 or 3 pinned courses for a clean comparison.");
        return;
      }
      showComparison = !showComparison;
    }
    if (feature === "cost") showCostEstimator = !showCostEstimator;
    if (feature === "share") share();
    if (feature === "compare-close") showComparison = false;
    if (feature === "cost-close") showCostEstimator = false;
    if (typeof view === "function") view();
  }

  function renderShortlistFeatures() {
    if (typeof mode === "undefined" || mode !== "short") return "";
    return featureControls();
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-feature]");
    if (button) toggleFeature(button.dataset.feature);
  });

  window.CourseCopilotShortlistFeatures = {
    renderShortlistFeatures,
    share
  };
})();