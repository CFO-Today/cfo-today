/* ==========================================================================
   오늘경리 — app.js
   모든 페이지 공통 동작
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------------------------------------------------------------
     유틸
     --------------------------------------------------------------------- */
  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /** 숫자를 "₩1,234" 형태로 (부호 포함) */
  function won(amount, signed) {
    const sign = amount > 0 ? "+" : "-";
    const body = "₩" + Math.abs(amount).toLocaleString("ko-KR");
    return signed ? sign + body : (amount < 0 ? "-" : "") + body;
  }

  /** 만원 단위 축약: 3800000 -> "+380만" */
  function manwon(amount) {
    const sign = amount > 0 ? "+" : "-";
    return sign + Math.round(Math.abs(amount) / 10000).toLocaleString("ko-KR") + "만";
  }

  /** 바이트를 읽기 좋은 단위로 */
  function fileSize(bytes) {
    if (bytes < 1024) return bytes + "B";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + "KB";
    return (bytes / 1024 / 1024).toFixed(1) + "MB";
  }

  /* ---------------------------------------------------------------------
     토스트
     --------------------------------------------------------------------- */
  let toastTimer = null;
  function toast(message) {
    let el = $(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  /* ---------------------------------------------------------------------
     현재 페이지 내비게이션 강조
     --------------------------------------------------------------------- */
  function markCurrentNav() {
    const here = location.pathname.split("/").pop() || "index.html";
    $$(".site-nav a[href]").forEach((a) => {
      const target = a.getAttribute("href").split("/").pop();
      if (target === here) a.setAttribute("aria-current", "page");
    });
  }

  /* ---------------------------------------------------------------------
     푸터 연도 자동 갱신
     --------------------------------------------------------------------- */
  function updateYear() {
    $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
  }

  /* ---------------------------------------------------------------------
     클립보드 복사  —  <button data-copy="복사할 텍스트">
     --------------------------------------------------------------------- */
  function initCopy() {
    $$("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const text = btn.dataset.copy;
        try {
          await navigator.clipboard.writeText(text);
          toast("링크를 복사했어요");
        } catch (err) {
          // clipboard API가 막힌 환경(비 HTTPS 등) 대비
          const tmp = document.createElement("textarea");
          tmp.value = text;
          tmp.setAttribute("readonly", "");
          tmp.style.cssText = "position:absolute;left:-9999px";
          document.body.appendChild(tmp);
          tmp.select();
          document.execCommand("copy");
          document.body.removeChild(tmp);
          toast("링크를 복사했어요");
        }
      });
    });
  }

  /* ---------------------------------------------------------------------
     모달  —  data-modal-open="id" / data-modal-close
     --------------------------------------------------------------------- */
  function initModals() {
    let lastFocused = null;

    function open(id) {
      const modal = document.getElementById(id);
      if (!modal) return;
      lastFocused = document.activeElement;
      modal.hidden = false;
      document.body.style.overflow = "hidden";
      const focusable = $("[autofocus], button, a[href], input", modal);
      if (focusable) focusable.focus();
    }

    function close(modal) {
      if (!modal || modal.hidden) return;
      modal.hidden = true;
      document.body.style.overflow = "";
      if (lastFocused) lastFocused.focus();
    }

    $$("[data-modal-open]").forEach((btn) => {
      btn.addEventListener("click", () => open(btn.dataset.modalOpen));
    });

    $$(".modal").forEach((modal) => {
      // 배경 클릭으로 닫기
      modal.addEventListener("click", (e) => {
        if (e.target === modal) close(modal);
      });
      $$("[data-modal-close]", modal).forEach((btn) => {
        btn.addEventListener("click", () => close(modal));
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") $$(".modal:not([hidden])").forEach(close);
    });

    // 다른 스크립트에서 쓸 수 있도록 노출
    window.OK = window.OK || {};
    window.OK.openModal = open;
    window.OK.closeModal = (id) => close(document.getElementById(id));
  }

  /* ---------------------------------------------------------------------
     드롭존  —  파일 선택 / 드래그앤드롭
     선택된 파일은 sessionStorage에 담아 다음 화면으로 넘긴다.
     --------------------------------------------------------------------- */
  function initDropzone() {
    $$(".dropzone").forEach((zone) => {
      const input = $('input[type="file"]', zone);
      if (!input) return;

      const nextUrl = zone.dataset.next;

      zone.addEventListener("click", (e) => {
        // <label>이 input을 감싸고 있으면 브라우저가 파일 창을 직접 연다.
        // 여기서 input.click()을 또 호출하면 창이 두 번 열린다.
        if (e.target.closest("label")) return;
        input.click();
      });

      ["dragenter", "dragover"].forEach((type) => {
        zone.addEventListener(type, (e) => {
          e.preventDefault();
          zone.classList.add("is-over");
        });
      });
      ["dragleave", "drop"].forEach((type) => {
        zone.addEventListener(type, (e) => {
          e.preventDefault();
          if (type === "dragleave" && zone.contains(e.relatedTarget)) return;
          zone.classList.remove("is-over");
        });
      });

      zone.addEventListener("drop", (e) => {
        if (e.dataTransfer && e.dataTransfer.files.length) {
          handleFiles(e.dataTransfer.files);
        }
      });
      input.addEventListener("change", () => {
        if (input.files.length) handleFiles(input.files);
      });

      function handleFiles(fileList) {
        const files = Array.from(fileList).map((f) => ({
          name: f.name,
          size: fileSize(f.size),
        }));
        try {
          const prev = JSON.parse(sessionStorage.getItem("ok:files") || "[]");
          sessionStorage.setItem("ok:files", JSON.stringify(prev.concat(files)));
        } catch (err) {
          /* 프라이빗 모드 등 — 저장 실패해도 이동은 계속 */
        }
        if (nextUrl) location.href = nextUrl;
        else toast(files.length + "개 파일을 선택했어요");
      }
    });
  }

  /* ---------------------------------------------------------------------
     세그먼트 탭  —  [role="tablist"] 안의 버튼
     --------------------------------------------------------------------- */
  function initSegments() {
    $$(".segment").forEach((seg) => {
      const btns = $$(".segment__btn", seg);
      btns.forEach((btn) => {
        btn.addEventListener("click", () => {
          btns.forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
          seg.dispatchEvent(new CustomEvent("segmentchange", {
            detail: { value: btn.dataset.value },
            bubbles: true,
          }));
        });
      });
    });
  }

  /* ---------------------------------------------------------------------
     초기화
     --------------------------------------------------------------------- */
  function init() {
    markCurrentNav();
    updateYear();
    initCopy();
    initModals();
    initDropzone();
    initSegments();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* 공용 헬퍼 노출 */
  window.OK = Object.assign(window.OK || {}, {
    $, $$, won, manwon, fileSize, toast,
  });
})();
