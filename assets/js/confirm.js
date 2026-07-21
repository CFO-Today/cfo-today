/* ==========================================================================
   오늘경리 — confirm.js
   예상 분류 확인 화면: 거래 목록 렌더 · 분류 드롭다운 · 검토 필요 카운트
   ========================================================================== */
(function () {
  "use strict";

  const { $, won, toast } = window.OK;

  /* ---------------------------------------------------------------------
     데이터  (실제 서비스에서는 API 응답으로 교체)
     --------------------------------------------------------------------- */
  const INCOME_OPTS = [
    { name: "매출", sub: "제품·서비스" },
    { name: "기타 수입", sub: "" },
  ];

  const EXPENSE_OPTS = [
    { name: "인건비",           sub: "급여·알바" },
    { name: "임차료",           sub: "사무실·주차" },
    { name: "복리후생비",       sub: "식대·커피·회식" },
    { name: "외주비",           sub: "프리랜서·에이전시" },
    { name: "광고·마케팅비",    sub: "" },
    { name: "소프트웨어 구독료", sub: "" },
    { name: "교통·출장비",      sub: "" },
    { name: "사무용품·소모품",  sub: "" },
    { name: "세금·공과금",      sub: "" },
    { name: "기타 지출",        sub: "" },
  ];

  const TRANSACTIONS = [
    { date: "05.03", name: "○○마트 정기 납품",  amount:  3800000, base: "매출",     editable: false, review: false },
    { date: "05.08", name: "5월 아르바이트 급여", amount:  -950000, base: "인건비",   editable: false, review: false },
    { date: "05.10", name: "사무실 임대료",      amount:  -550000, base: "임차료",   editable: false, review: false },
    { date: "05.15", name: "스타벅스 강남점",    amount:   -38000, base: "기타 지출", editable: true,  review: true  },
    { date: "05.24", name: "홍길동",            amount:  -200000, base: "기타 지출", editable: true,  review: true  },
  ];

  /** 업로드 시뮬레이션으로 추가되는 거래 */
  const EXTRA = [
    { date: "05.28", name: "배달 정산 입금 (추가)", amount: 540000, base: "매출",     editable: false, review: false },
    { date: "05.29", name: "택시비 (추가)",        amount: -18000, base: "기타 지출", editable: true,  review: true  },
  ];

  /* ---------------------------------------------------------------------
     상태
     --------------------------------------------------------------------- */
  const state = {
    rows: TRANSACTIONS.map((t, i) => ({ ...t, id: "tx" + i, chosen: null })),
    openId: null,
  };

  const listEl = $("#tx-list");
  if (!listEl) return;

  /* ---------------------------------------------------------------------
     헬퍼
     --------------------------------------------------------------------- */
  const INCOME_CATS = ["매출", "기타 수입"];
  const DIRECT_COST = ["인건비", "임차료", "복리후생비", "외주비"];

  /** 분류명 → 태그 색상 클래스 */
  function catClass(cat) {
    if (INCOME_CATS.includes(cat)) return "tag--in";
    if (DIRECT_COST.includes(cat))  return "tag--out";
    return "tag--etc";
  }

  function currentCat(row) {
    return row.chosen || row.base;
  }

  /** 아직 분류를 고르지 않은 검토 필요 건 */
  function reviewRows() {
    return state.rows.filter((r) => r.review && !r.chosen);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  /* ---------------------------------------------------------------------
     렌더
     --------------------------------------------------------------------- */
  function optionsMarkup(row, list) {
    const cat = currentCat(row);
    return list.map((o) => `
      <button type="button" class="cat-opt" data-pick="${escapeHtml(o.name)}"
              aria-pressed="${o.name === cat}">
        <span class="cat-opt__name">${escapeHtml(o.name)}</span>
        ${o.sub ? `<span class="cat-opt__sub">${escapeHtml(o.sub)}</span>` : ""}
      </button>`).join("");
  }

  function rowMarkup(row) {
    const cat       = currentCat(row);
    const isReview  = row.review && !row.chosen;
    const isOpen    = state.openId === row.id;
    const tagClass  = isReview ? "tag--etc" : catClass(cat);
    const amtColor  = row.amount > 0 ? "var(--in)" : "var(--out)";

    const catCell = row.editable
      ? `<button type="button" class="cat-btn ${tagClass}" data-toggle="${row.id}"
                 aria-expanded="${isOpen}" aria-controls="panel-${row.id}">
           <span>${escapeHtml(cat)}</span>
           <svg class="cat-btn__chev" width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg>
         </button>`
      : `<span class="tag ${tagClass}" style="width:128px">${escapeHtml(cat)}</span>`;

    return `
      <li class="tx-item${isReview ? " is-review" : ""}" id="row-${row.id}">
        <div class="tx-row">
          <span class="tx-row__date">${escapeHtml(row.date)}</span>
          <span class="tx-row__name">
            <span>${escapeHtml(row.name)}</span>
            ${isReview ? '<span class="tag tag--review">검토 필요</span>' : ""}
          </span>
          <span class="tx-row__cat">${catCell}</span>
          <span class="tx-row__amt" style="color:${amtColor}">${won(row.amount, true)}</span>
        </div>

        ${row.editable ? `
        <div class="cat-panel" id="panel-${row.id}" ${isOpen ? "" : "hidden"}>
          <p class="cat-panel__label">어떤 분류인가요?</p>
          <p class="cat-panel__group t-in">수입</p>
          <div class="cat-panel__opts">${optionsMarkup(row, INCOME_OPTS)}</div>
          <p class="cat-panel__group t-accent">지출</p>
          <div class="cat-panel__opts" style="margin-bottom:0">${optionsMarkup(row, EXPENSE_OPTS)}</div>
        </div>` : ""}
      </li>`;
  }

  function renderList() {
    listEl.innerHTML = state.rows.map(rowMarkup).join("");
  }

  function renderSummary() {
    const income  = state.rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
    const expense = state.rows.filter((r) => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0);

    const manwon = (n) => Math.round(n / 10000).toLocaleString("ko-KR") + "만원";
    $("#sum-income").textContent  = manwon(income);
    $("#sum-expense").textContent = manwon(expense);

    const pending = reviewRows().length;
    const card  = $("#review-card");
    const value = $("#review-value");

    value.textContent = pending === 0 ? "완료" : pending + "건";
    card.classList.toggle("stat--done", pending === 0);
    card.classList.toggle("stat--review", pending > 0);
    card.disabled = pending === 0;
  }

  function render() {
    renderList();
    renderSummary();
  }

  /* ---------------------------------------------------------------------
     상호작용
     --------------------------------------------------------------------- */
  listEl.addEventListener("click", (e) => {
    const toggleBtn = e.target.closest("[data-toggle]");
    if (toggleBtn) {
      const id = toggleBtn.dataset.toggle;
      state.openId = state.openId === id ? null : id;
      render();
      // 열린 패널로 포커스 유지
      const again = listEl.querySelector(`[data-toggle="${id}"]`);
      if (again) again.focus();
      return;
    }

    const pickBtn = e.target.closest("[data-pick]");
    if (pickBtn) {
      const item = pickBtn.closest(".tx-item");
      const id   = item.id.replace("row-", "");
      const row  = state.rows.find((r) => r.id === id);
      row.chosen = pickBtn.dataset.pick;
      state.openId = null;
      render();
      toast(`"${row.name}" → ${row.chosen}`);
    }
  });

  /* 검토 필요 카드 → 첫 검토 항목으로 스크롤 */
  $("#review-card").addEventListener("click", () => {
    const first = reviewRows()[0];
    if (!first) return;
    const el = document.getElementById("row-" + first.id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.style.transition = "box-shadow .25s";
    el.style.boxShadow = "inset 0 0 0 2px var(--accent)";
    setTimeout(() => { el.style.boxShadow = ""; }, 1000);
  });

  /* 파일 추가 → 분석 시뮬레이션 후 거래 2건 추가 */
  const addForm = $("#add-file-form");
  if (addForm) {
    addForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const strip = $("#analyzing");
      window.OK.closeModal("upload-modal");
      strip.hidden = false;

      setTimeout(() => {
        strip.hidden = true;
        const start = state.rows.length;
        EXTRA.forEach((t, i) => {
          state.rows.push({ ...t, id: "tx" + (start + i), chosen: null });
        });
        render();
        toast("새 거래 " + EXTRA.length + "건을 추가했어요");
      }, 1600);
    });
  }

  render();
})();
