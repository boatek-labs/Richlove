const inviteFromUrl = new URLSearchParams(window.location.search).get("invite");
if (inviteFromUrl) {
  sessionStorage.setItem("proposer_invite", inviteFromUrl);
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("invite");
  window.history.replaceState({}, "", cleanUrl.pathname + cleanUrl.hash);
}
const inviteToken = sessionStorage.getItem("proposer_invite") || "";

const revealItems = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

async function sendJson(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Invite-Token": inviteToken
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

function showFeedback(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.style.color = isError ? "#e4a9a5" : "";
}

const responseFeedback = document.getElementById("response-feedback");
const choiceGrid = document.getElementById("choice-grid");
const afterYes = document.getElementById("after-yes");
const afterTime = document.getElementById("after-time");
const afterNo = document.getElementById("after-no");

document.querySelectorAll("[data-choice]").forEach((button) => {
  button.addEventListener("click", async () => {
    if (!inviteToken) {
      showFeedback(responseFeedback, "This page needs the private invitation link Foster sent you. Please open that original link.", true);
      return;
    }
    const choice = button.dataset.choice;
    const original = button.innerHTML;
    button.disabled = true;
    button.textContent = "Saving...";
    showFeedback(responseFeedback, "");
    try {
      await sendJson("/api/response", { choice });
      choiceGrid.classList.add("panel-hidden");
      responseFeedback.textContent = "";
      if (choice === "yes") afterYes.classList.remove("panel-hidden");
      if (choice === "time") afterTime.classList.remove("panel-hidden");
      if (choice === "no") afterNo.classList.remove("panel-hidden");
      (choice === "yes" ? afterYes : choice === "time" ? afterTime : afterNo).scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      button.disabled = false;
      button.innerHTML = original;
      showFeedback(responseFeedback, error.message, true);
    }
  });
});

const nicknameInput = document.getElementById("nickname");
const nicknameButton = document.getElementById("save-nickname");
const nicknameFeedback = document.getElementById("nickname-feedback");
nicknameButton?.addEventListener("click", async () => {
  const nickname = nicknameInput.value.trim();
  if (!nickname) {
    showFeedback(nicknameFeedback, "Type the name you'd like Foster to call you.", true);
    nicknameInput.focus();
    return;
  }
  nicknameButton.disabled = true;
  nicknameButton.textContent = "Saving...";
  try {
    await sendJson("/api/nickname", { nickname });
    showFeedback(nicknameFeedback, `Saved. Foster will know you'd like to be called “${nickname}”. ❤️`);
    nicknameInput.disabled = true;
    nicknameButton.textContent = "Saved ✓";
  } catch (error) {
    nicknameButton.disabled = false;
    nicknameButton.innerHTML = 'Save it <span>♡</span>';
    showFeedback(nicknameFeedback, error.message, true);
  }
});

const questionForm = document.getElementById("question-form");
const questionFeedback = document.getElementById("question-feedback");
questionForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const field = document.getElementById("question");
  const question = field.value.trim();
  if (!question) {
    showFeedback(questionFeedback, "Write a question or message first.", true);
    field.focus();
    return;
  }
  const submit = questionForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = "Sending...";
  try {
    await sendJson("/api/questions", { question });
    field.value = "";
    showFeedback(questionFeedback, "Your message has been sent to Foster. Thank you.");
    submit.textContent = "Sent ✓";
  } catch (error) {
    showFeedback(questionFeedback, error.message, true);
    submit.disabled = false;
    submit.innerHTML = 'Send to Foster <span>↗</span>';
  }
});
