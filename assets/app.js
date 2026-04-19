(function () {
  "use strict";
  const API_URL = "./api-proxy.php";
  let currentData = null;
  let historyChart = null;
  let sortAscending = true;

  const loadingArea = document.getElementById("loadingArea");
  const contentDiv = document.getElementById("dashboardContent");
  const updateTimeSpan = document.getElementById("timeDisplay");
  const healthValueSpan = document.getElementById("healthValue");
  const statusTagDiv = document.getElementById("statusTag");
  const serviceCountSpan = document.getElementById("serviceCount");
  const servicesContainer = document.getElementById("servicesContainer");
  const gaugeFill = document.getElementById("gaugeFill");
  const refreshBtn = document.getElementById("refreshBtn");
  const searchInput = document.getElementById("searchInput");
  const sortBtn = document.getElementById("sortBtn");
  const chartCtx = document.getElementById("historyChart").getContext("2d");

  const statusTranslations = {
    normal: "عادی",
    degraded: "نیمه‌اختلال",
    down: "قطع",
    severe: "اختلال شدید",
    unknown: "نامشخص",
  };

  function updateGauge(health) {
    const circumference = 2 * Math.PI * 58;
    const offset = circumference - (health / 100) * circumference;
    gaugeFill.style.strokeDashoffset = offset;
    let color =
      health >= 80
        ? "oklch(0.596 0.145 163.225)"
        : health >= 50
          ? "oklch(0.681 0.162 75.834)"
          : "oklch(0.637 0.237 25.331)";
    gaugeFill.style.stroke = color;
  }

  function formatTime(timeStr) {
    if (!timeStr) return "--:--";
    if (timeStr.includes(" ") && timeStr.includes("-")) {
      const parts = timeStr.split(" ");
      if (parts.length >= 2) {
        const timePart = parts[1];
        return timePart.substring(0, 5);
      }
    }
    if (timeStr.includes("T")) {
      const date = new Date(timeStr);
      return date.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return timeStr.substring(0, 5);
  }

  function getIconClass(name) {
    const lower = name.toLowerCase();
    if (lower.includes("google") || lower.includes("gmail"))
      return "fab fa-google";
    if (lower.includes("github")) return "fab fa-github";
    if (lower.includes("microsoft") || lower.includes("bing"))
      return "fab fa-microsoft";
    if (lower.includes("whatsapp")) return "fab fa-whatsapp";
    if (lower.includes("wikipedia")) return "fab fa-wikipedia-w";
    if (lower.includes("stackoverflow")) return "fab fa-stack-overflow";
    if (lower.includes("playstation")) return "fab fa-playstation";
    if (lower.includes("wordpress")) return "fab fa-wordpress";
    if (lower.includes("python") || lower.includes("pypi"))
      return "fab fa-python";
    if (lower.includes("ubuntu")) return "fab fa-ubuntu";
    if (lower.includes("npm")) return "fab fa-npm";
    if (lower.includes("react")) return "fab fa-react";
    if (lower.includes("vercel")) return "fas fa-triangle";
    if (lower.includes("cloudflare")) return "fas fa-cloud";
    if (lower.includes("chatgpt") || lower.includes("openai"))
      return "fas fa-robot";
    return "fas fa-globe";
  }

  function renderServices(services, filterText = "", sortOnlineFirst = true) {
    let entries = Object.entries(services);

    if (filterText.trim()) {
      const term = filterText.trim().toLowerCase();
      entries = entries.filter(([name]) => name.toLowerCase().includes(term));
    }
    // Sort
    entries.sort((a, b) => {
      const aUp = a[1].up;
      const bUp = b[1].up;
      if (aUp === bUp) {
        if (aUp) return (a[1].ms || 0) - (b[1].ms || 0);
        return a[0].localeCompare(b[0]);
      }
      return sortOnlineFirst ? (aUp ? -1 : 1) : aUp ? 1 : -1;
    });

    let html = "";
    for (const [name, info] of entries) {
      const up = info.up;
      const ms = info.ms;
      const dotClass = up ? "" : "down";
      const latencyText = up ? `${ms} ms` : "—";
      const iconClass = getIconClass(name);
      html += `
                    <div class="service-item" data-service="${name.replace(/"/g, "&quot;")}" style="border:2px solid ${up ? "oklch(0.765 0.177 163.223)" : "oklch(0.637 0.237 25.331)"};">
                        <div class="service-header"><i class="${iconClass}"></i><a target="_blank" href="https://${name}" class="service-name">${name}</a></div>
                        <div class="service-status">
                            <span dir="ltr" class="latency">${latencyText}</span>
                        </div>
                    </div>
                `;
    }
    servicesContainer.innerHTML =
      html ||
      '<div class="loading-placeholder" style="grid-column:1/-1;">بدون سرویس</div>';
  }

  function renderData(data) {
    currentData = data;
    const current = data.current || {};
    const health = current.health ?? 0;
    const status = current.status || "unknown";
    const updated = current.updated || data.meta?.server_time || "";

    updateTimeSpan.textContent = formatTime(updated);
    healthValueSpan.textContent = health + "%";
    updateGauge(health);

    statusTagDiv.textContent = statusTranslations[status] || status;
    statusTagDiv.className = `status-tag status-${status}`;

    const services = data.services || {};
    const upCount = Object.values(services).filter((s) => s.up).length;
    serviceCountSpan.textContent = `${upCount}/${Object.keys(services).length} سرویس`;

    renderServices(services, searchInput.value, sortAscending);

    Chart.defaults.font.family = "'IRANYekan', tahoma";
    const history = data.history || [];
    const labels = history.map((entry) => entry.t);
    const values = history.map((entry) => entry.h);

    if (historyChart) {
      historyChart.data.labels = labels;
      historyChart.data.datasets[0].data = values;
      historyChart.update();
    } else {
      historyChart = new Chart(chartCtx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "وضعیت",
              data: values,
              borderColor: "oklch(0.765 0.177 163.223)",
              backgroundColor: "oklch(0.696 0.17 162.48 / 7%)",
              borderWidth: 3,
              pointBackgroundColor: "oklch(0.905 0.093 164.15)",
              pointBorderColor: "oklch(0.37 0.013 285.805 / 10%)",
              pointRadius: 2,
              pointHoverRadius: 5,
              tension: 0.3,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "oklch(0.37 0.013 285.805)",
              titleColor: "oklch(0.967 0.001 286.375)",
              bodyColor: "oklch(0.92 0.004 286.32)",
            },
          },
          scales: {
            y: {
              min: 0,
              max: 100,
              grid: { color: "rgba(255,255,255,0.05)" },
              ticks: { color: "oklch(0.871 0.006 286.286)" },
            },
            x: {
              grid: { display: false },
              ticks: {
                color: "#9ca8c9",
                maxRotation: 45,
                minRotation: 30,
                maxTicksLimit: 12,
                autoSkip: true,
              },
            },
          },
        },
      });
    }

    loadingArea.style.display = "none";
    contentDiv.style.display = "flex";
  }

  async function fetchData() {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text(); // Get raw text first
      try {
        const data = JSON.parse(text);
        renderData(data);
      } catch (e) {
        console.error("Invalid JSON:", text.substring(0, 200));
        throw new Error("پاسخ سرور معتبر نیست");
      }
    } catch (err) {
      console.error(err);
      loadingArea.innerHTML = `<div class="loading-placeholder">
            <i class="fas fa-exclamation-triangle"></i>
            <p>خطا در بارگذاری داده ها.</p>
            <small style="color:#fca5a5;">${err.message}</small>
            <br><button class="refresh-btn" onclick="location.reload()">تلاش مجدد</button>
        </div>`;
      contentDiv.style.display = "none";
    }
  }

  // Event listeners
  refreshBtn.addEventListener("click", fetchData);
  searchInput.addEventListener("input", () => {
    if (currentData)
      renderServices(currentData.services, searchInput.value, sortAscending);
  });
  sortBtn.addEventListener("click", () => {
    sortAscending = !sortAscending;
    sortBtn.innerHTML = sortAscending
      ? '<i class="fal fa-sort-up"></i> آنلاین'
      : '<i class="fal fa-sort-down"></i> آفلاین';
    if (currentData)
      renderServices(currentData.services, searchInput.value, sortAscending);
  });

  // Initialize
  fetchData();
  setInterval(fetchData, 60000);
})();
