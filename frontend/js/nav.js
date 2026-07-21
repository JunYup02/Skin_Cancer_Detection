/** Shared chrome behavior: back button + account button (logout) on every screen. */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-nav-back]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const fallback = btn.getAttribute("data-nav-back") || "dashboard.html";
      if (window.history.length > 1) window.history.back();
      else window.location.href = fallback;
    });
  });

  document.querySelectorAll("[data-account-btn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (window.confirm("Log out of Dermalyze?")) logout();
    });
  });

  const usernameEl = document.querySelector("[data-username]");
  if (usernameEl) usernameEl.textContent = currentUsername() || "there";
});
