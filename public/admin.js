const loginPanel = document.getElementById("login-panel");
const dashboardPanel = document.getElementById("dashboard-panel");
const loginForm = document.getElementById("login-form");
const loginFeedback = document.getElementById("login-feedback");
const dashboardFeedback = document.getElementById("dashboard-feedback");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
function renderEntries(target, items, titleKey, bodyKey, empty) {
  const element = document.getElementById(target);
  if (!items.length) {
    element.innerHTML = '<p class="admin-empty">' + escapeHtml(empty) + '</p>';
    return;
  }
  element.innerHTML = items.map((item) => `
    <article class="admin-entry">
      <strong>${escapeHtml(item[titleKey])}</strong>
      ${item[bodyKey] ? '<p>' + escapeHtml(item[bodyKey]) + '</p>' : ""}
      <time>${escapeHtml(formatDate(item.created_at))}</time>
    </article>
  `).join("");
}
async function loadDashboard() {
  const data = await api("/api/admin/overview");
  renderEntries("response-list", data.responses, "choice", "message", "No response has been submitted yet.");
  renderEntries("nickname-list", data.nicknames, "nickname", "", "No nickname has been chosen yet.");
  renderEntries("question-list", data.questions, "question", "", "No questions or messages yet.");
  loginPanel.classList.add("panel-hidden");
  dashboardPanel.classList.remove("panel-hidden");
}
loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector("button");
  button.disabled = true;
  loginFeedback.textContent = "";
  try {
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password: document.getElementById("admin-password").value })
    });
    await loadDashboard();
  } catch (error) {
    loginFeedback.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
document.getElementById("logout-button")?.addEventListener("click", async () => {
  try { await api("/api/admin/logout", { method: "POST", body: "{}" }); } catch {}
  dashboardPanel.classList.add("panel-hidden");
  loginPanel.classList.remove("panel-hidden");
  document.getElementById("admin-password").value = "";
});
