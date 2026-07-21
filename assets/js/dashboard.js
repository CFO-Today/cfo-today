/* ==========================================================================
   오늘경리 — dashboard.js
   마이페이지: 홈 · 월별 내역 · 연간 요약 · 패키지 전달
   ========================================================================== */
(function () {
  "use strict";

  const { $, $$, won, toast } = window.OK;

  /* ---------------------------------------------------------------------
     데이터  (실제 서비스에서는 API 응답으로 교체)
     --------------------------------------------------------------------- */
  const MAY = [
    { date: "05.03", name: "○○마트 정기 납품",  cat: "매출",             amount:  3800000 },
    { date: "05.05", name: "컨설팅 수익",        cat: "매출",             amount:  1200000 },
    { date: "05.08", name: "5월 직원 급여",      cat: "인건비",           amount: -1500000 },
    { date: "05.10", name: "사무실 임대료",      cat: "임차료",           amount:  -550000 },
    { date: "05.13", name: "네이버 광고비",      cat: "광고·마케팅비",     amount:  -320000 },
    { date: "05.15", name: "스타벅스 강남점",    cat: "복리후생비",        amount:   -38000 },
    { date: "05.20", name: "쿠팡 사무용품",      cat: "사무용품·소모품",   amount:   -64000 },
    { date: "05.22", name: "디자인 외주 (로고)", cat: "외주비",           amount:  -400000 },
    { date: "05.27", name: "클라우드 구독료",    cat: "소프트웨어 구독료", amount:   -89000 },
  ];

  /** [수입, 지출] — 만원 단위, index 0 = 1월 */
  const MONTHLY_TOTALS = [
    [420, 240], [480, 280], [680, 330], [520, 300], [500, 296], [650, 201],
    [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0],
  ];

  const DELIVERIES = [
    { label: "2025년 5월", sub: "2025.06.03 · 카카오톡 전달", cnt: "84건", done: true },
    { label: "2025년 4월", sub: "2025.05.04 · 파일 다운로드", cnt: "76건", done: true },
    { label: "2025년 3월", sub: "2025.04.05 · 카카오톡 전달", cnt: "91건", done: true },
  ];

  const HISTORY = [
    { month: 5, cnt: 84, done: false },
    { month: 4, cnt: 76, done: true },
    { month: 3, cnt: 91, done: true },
  ];

  /* ---------------------------------------------------------------------
     상태
     --------------------------------------------------------------------- */
  const state = {
    panel: "monthly",
    month: 5,
    view: "daily",
    filter: "all",
  };

  /* ---------------------------------------------------------------------
     헬퍼
     --------------------------------------------------------------------- */
  const INCOME_CATS = ["매출", "기타 수입"];
  const DIRECT_COST = ["인건비", "임차료", "복리후생비", "외주비"];

  function catClass(cat) {
    if (INCOME_CATS.includes(cat)) return "tag--in";
    if (DIRECT_COST.includes(cat))  return "tag--out";
    return "tag--etc";
  }

  /** 만원 단위 정수 → "650만원" */
  const man = (n) => n.toLocaleString("ko-KR") + "만원";

  /** 해당 월의 거래 목록 (데모: 5월 데이터를 날짜만 바꿔 재사용) */
  function txOf(month) {
    if (month === 5) return MAY;
    const mm = String(month).padStart(2, "0");
    return MAY.map((t) => ({ ...t, date: mm + t.date.slice(2) }));
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  /* ---------------------------------------------------------------------
     월별 내역 패널
     --------------------------------------------------------------------- */
  function renderMonthly() {
    const all     = txOf(state.month);
    const income  = all.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expense = all.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

    $("#m-label").textContent   = "2025년 " + state.month + "월";
    $("#m-income").textContent  = won(income);
    $("#m-expense").textContent = won(expense);
    $("#m-net").textContent     = won(income - expense);

    $("#m-prev").disabled = state.month <= 1;
    $("#m-next").disabled = state.month >= 12;

    const body = $("#m-body");

    if (state.view === "monthly") {
      // 분류별 집계
      const order = [];
      const map = {};
      all.forEach((t) => {
        if (!map[t.cat]) { map[t.cat] = { cat: t.cat, count: 0, total: 0 }; order.push(t.cat); }
        map[t.cat].count += 1;
        map[t.cat].total += t.amount;
      });

      body.innerHTML = `<ul>${order.map((k) => {
        const g = map[k];
        return `
          <li class="tx-item">
            <div class="tx-row">
              <span class="tx-row__name">
                <span class="tag ${catClass(g.cat)}">${escapeHtml(g.cat)}</span>
                <span class="t-fine">${g.count}건</span>
              </span>
              <span class="tx-row__amt" style="color:${g.total > 0 ? "var(--accent-strong)" : "#8A8178"}">
                ${won(g.total, true)}
              </span>
            </div>
          </li>`;
      }).join("")}</ul>`;
      $("#m-count").textContent = order.length + "개 분류";
      return;
    }

    // 일자별
    let shown = all;
    if (state.filter === "income")  shown = all.filter((t) => t.amount > 0);
    if (state.filter === "expense") shown = all.filter((t) => t.amount < 0);

    $("#m-count").textContent = shown.length + "건";

    if (!shown.length) {
      body.innerHTML = '<p class="t-center t-muted" style="padding:34px 16px">해당하는 거래가 없어요.</p>';
      return;
    }

    body.innerHTML = `<ul>${shown.map((t) => `
      <li class="tx-item">
        <div class="tx-row">
          <span class="tx-row__date">${escapeHtml(t.date)}</span>
          <span class="tx-row__name"><span>${escapeHtml(t.name)}</span></span>
          <span class="tx-row__cat">
            <span class="tag ${catClass(t.cat)}">${escapeHtml(t.cat)}</span>
          </span>
          <span class="tx-row__amt" style="color:${t.amount > 0 ? "var(--accent-strong)" : "#8A8178"}">
            ${won(t.amount, true)}
          </span>
        </div>
      </li>`).join("")}</ul>`;
  }

  /* ---------------------------------------------------------------------
     홈 패널
     --------------------------------------------------------------------- */
  function renderHome() {
    const cur = MONTHLY_TOTALS[5]; // 6월
    $("#h-income").textContent  = man(cur[0]);
    $("#h-expense").textContent = man(cur[1]);
    $("#h-net").textContent     = man(cur[0] - cur[1]);

    $("#h-history").innerHTML = HISTORY.map((h) => {
      const t = MONTHLY_TOTALS[h.month - 1];
      return `
        <li class="history-item">
          <span class="spacer">
            <span class="history-item__label" style="display:block">2025년 ${h.month}월</span>
            <span class="history-item__sub">거래 ${h.cnt}건 · 순이익 ${man(t[0] - t[1])}</span>
          </span>
          <span class="status-dot" style="color:${h.done ? "var(--in)" : "var(--warn-deep)"}">
            ${h.done ? "세무사 전달 완료" : "정리 중"}
          </span>
        </li>`;
    }).join("");
  }

  /* ---------------------------------------------------------------------
     연간 요약 패널
     --------------------------------------------------------------------- */
  function renderYear() {
    let yi = 0, ye = 0;
    MONTHLY_TOTALS.forEach((t) => { if (t[0] > 0) { yi += t[0]; ye += t[1]; } });

    $("#y-income").textContent  = man(yi);
    $("#y-expense").textContent = man(ye);
    $("#y-net").textContent     = man(yi - ye);

    const max = Math.max(...MONTHLY_TOTALS.map((t) => t[0]), 1);

    $("#y-chart").innerHTML = MONTHLY_TOTALS.map((t, i) => {
      const n   = i + 1;
      const has = t[0] > 0;
      const sel = n === state.month;
      const incH = has ? Math.max(Math.round((t[0] / max) * 100), 4) : 5;
      const expH = has ? Math.max(Math.round((t[1] / max) * 100), 3) : 0;
      return `
        <div class="chart__col" style="opacity:${has ? 1 : .4}">
          <div class="chart__bars">
            <span class="chart__bar" style="height:${incH}%;background:${sel ? "var(--accent)" : (has ? "#F0C3AE" : "#E4D8CD")}"></span>
            <span class="chart__bar" style="height:${expH}%;background:${sel ? "#D9A441" : (has ? "#EFE2C9" : "transparent")}"></span>
          </div>
          <span class="chart__label" style="color:${sel ? "var(--accent-strong)" : (has ? "var(--muted)" : "var(--faint)")};font-weight:${sel ? 800 : 600}">${n}</span>
        </div>`;
    }).join("");

    $("#y-table").innerHTML = MONTHLY_TOTALS.map((t, i) => {
      const n   = i + 1;
      const has = t[0] > 0;
      const sel = n === state.month;
      const cell = (v) => (has ? man(v) : "—");
      return `
        <tr class="${sel ? "is-current" : ""}">
          <td${has ? "" : ' class="is-empty"'}>${n}월</td>
          <td${has ? "" : ' class="is-empty"'}>${cell(t[0])}</td>
          <td${has ? "" : ' class="is-empty"'}>${cell(t[1])}</td>
          <td${has ? ' style="color:var(--accent-strong);font-weight:800"' : ' class="is-empty"'}>${cell(t[0] - t[1])}</td>
        </tr>`;
    }).join("");
  }

  /* ---------------------------------------------------------------------
     패키지 전달 패널
     --------------------------------------------------------------------- */
  function renderPackage() {
    $("#p-count").textContent = txOf(state.month).length + "건";
    $("#p-list").innerHTML = DELIVERIES.map((d) => `
      <li class="history-item">
        <span class="spacer">
          <span class="history-item__label" style="display:block">${escapeHtml(d.label)}</span>
          <span class="history-item__sub">${escapeHtml(d.sub)}</span>
        </span>
        <span class="t-fine">${escapeHtml(d.cnt)}</span>
        <a class="btn btn--outline btn--sm" href="result.html">다시 보내기</a>
      </li>`).join("");
  }

  /* ---------------------------------------------------------------------
     패널 전환
     --------------------------------------------------------------------- */
  function showPanel(name) {
    state.panel = name;

    $$(".dash__panel").forEach((p) => { p.hidden = p.dataset.panel !== name; });
    $$("[data-nav]").forEach((btn) => {
      if (btn.dataset.nav === name) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });

    if (name === "home")    renderHome();
    if (name === "monthly") renderMonthly();
    if (name === "year")    renderYear();
    if (name === "package") renderPackage();
  }

  /* ---------------------------------------------------------------------
     이벤트
     --------------------------------------------------------------------- */
  $$("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => showPanel(btn.dataset.nav));
  });

  $("#m-prev").addEventListener("click", () => {
    state.month = Math.max(1, state.month - 1);
    renderMonthly();
  });
  $("#m-next").addEventListener("click", () => {
    state.month = Math.min(12, state.month + 1);
    renderMonthly();
  });

  $("#m-view").addEventListener("segmentchange", (e) => {
    state.view = e.detail.value;
    $("#m-filter").hidden = state.view !== "daily";
    renderMonthly();
  });

  $("#m-filter").addEventListener("segmentchange", (e) => {
    state.filter = e.detail.value;
    renderMonthly();
  });

  /* 탈퇴 확인 */
  const leaveBtn = $("#confirm-leave");
  if (leaveBtn) {
    leaveBtn.addEventListener("click", () => {
      window.OK.closeModal("leave-modal");
      window.OK.closeModal("profile-modal");
      toast("데모 화면이라 실제로 탈퇴되지는 않아요");
    });
  }

  showPanel("monthly");
})();
