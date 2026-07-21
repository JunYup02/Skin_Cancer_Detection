/**
 * Session storage + guards, shared by every page. Also drives the login and
 * signup forms directly (guarded by element existence, so it's safe to
 * include on every page).
 */

const TOKEN_KEY = "dermalyze_token";

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

function setToken(token, remember) {
  clearToken();
  (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

function isLoggedIn() {
  return Boolean(getToken());
}

/** Redirects to the login page if there's no session. Call at the top of protected pages. */
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = "index.html";
  }
}

/** Reads the username out of the JWT payload (issued by the backend) without a network call. */
function currentUsername() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.username || null;
  } catch {
    return null;
  }
}

function logout() {
  clearToken();
  window.location.href = "index.html";
}

function setButtonBusy(button, busy, busyLabel) {
  if (busy) {
    button.dataset.originalLabel = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span>${busyLabel || "Please wait…"}`;
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.originalLabel || button.innerHTML;
  }
}

function showBanner(el, message) {
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden");
}
function hideBanner(el) {
  if (!el) return;
  el.classList.add("hidden");
}

/* ---------------------------------------------------------------- */
/* Login page                                                        */
/* ---------------------------------------------------------------- */
(function wireLoginForm() {
  const form = document.getElementById("login-form");
  if (!form) return;

  if (isLoggedIn()) window.location.href = "dashboard.html";

  const errorBanner = document.getElementById("login-error");
  const passwordInput = document.getElementById("password");
  const toggleBtn = document.getElementById("toggle-password");

  toggleBtn?.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    toggleBtn.querySelector(".material-symbols-outlined").textContent = isPassword
      ? "visibility_off"
      : "visibility";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideBanner(errorBanner);
    const submitBtn = form.querySelector('button[type="submit"]');
    const username = document.getElementById("username").value.trim();
    const password = passwordInput.value;
    const remember = document.getElementById("remember")?.checked ?? false;

    setButtonBusy(submitBtn, true, "Logging in…");
    try {
      const { access_token } = await Api.login(username, password);
      setToken(access_token, remember);
      window.location.href = "dashboard.html";
    } catch (err) {
      showBanner(errorBanner, err.message);
    } finally {
      setButtonBusy(submitBtn, false);
    }
  });

  // Friendly banner if redirected here right after creating an account
  const params = new URLSearchParams(window.location.search);
  if (params.get("signup") === "success") {
    document.getElementById("login-success-note")?.classList.remove("hidden");
  }
})();

/* ---------------------------------------------------------------- */
/* Signup page                                                       */
/* ---------------------------------------------------------------- */
(function wireSignupForm() {
  const form = document.getElementById("signup-form");
  if (!form) return;

  if (isLoggedIn()) window.location.href = "dashboard.html";

  const errorBanner = document.getElementById("signup-error");
  const sexInput = document.getElementById("sex-input");

  document.querySelectorAll(".sex-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sex-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      sexInput.value = btn.dataset.sex;
    });
  });

  document.querySelectorAll(".toggle-password").forEach((toggleBtn) => {
    toggleBtn.addEventListener("click", () => {
      const input = toggleBtn.parentElement.querySelector("input");
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      toggleBtn.querySelector(".material-symbols-outlined").textContent = isPassword
        ? "visibility_off"
        : "visibility";
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideBanner(errorBanner);
    const submitBtn = form.querySelector('button[type="submit"]');

    const payload = {
      full_name: document.getElementById("full-name").value.trim(),
      username: document.getElementById("username").value.trim(),
      password: document.getElementById("password").value,
      confirm_password: document.getElementById("confirm-password").value,
      age: Number(document.getElementById("age").value),
      sex: sexInput.value,
      agree_terms: document.getElementById("agree-terms").checked,
    };

    if (!payload.sex) {
      showBanner(errorBanner, "Please select a gender identity option.");
      return;
    }

    setButtonBusy(submitBtn, true, "Creating account…");
    try {
      await Api.signup(payload);
      window.location.href = "index.html?signup=success";
    } catch (err) {
      showBanner(errorBanner, err.message);
    } finally {
      setButtonBusy(submitBtn, false);
    }
  });
})();
