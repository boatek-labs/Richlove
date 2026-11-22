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
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

function showFeedback(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

const responseFeedback = document.getElementById("response-feedback");
const choiceGrid = document.getElementById("choice-grid");
const afterYes = document.getElementById("after-yes");
const afterTime = document.getElementById("after-time");
const afterNo = document.getElementById("after-no");
const nicknameInput = document.getElementById("nickname");
const nicknameButton = document.getElementById("save-nickname");
const nicknameFeedback = document.getElementById("nickname-feedback");

async function restoreSavedState() {
  try {
    const response = await fetch("/api/my-state", { credentials: "same-origin" });
    if (!response.ok) return;
    const state = await response.json();
    if (!state.response) return;
    choiceGrid.classList.add("panel-hidden");
    if (state.response.choice === "yes") {
      afterYes.classList.remove("panel-hidden");
      if (state.nickname?.nickname) {
        nicknameInput.value = state.nickname.nickname;
        nicknameInput.disabled = true;
        nicknameButton.disabled = true;
        nicknameButton.textContent = "Saved ✓";
        showFeedback(nicknameFeedback, `Your chosen name is saved: “${state.nickname.nickname}”.`);
      }
    } else if (state.response.choice === "time") {
      afterTime.classList.remove("panel-hidden");
    } else if (state.response.choice === "no") {
      afterNo.classList.remove("panel-hidden");
    }
  } catch {
    // The story remains readable if the database is temporarily unavailable.
  }
}
restoreSavedState();

document.querySelectorAll("[data-choice]").forEach((button) => {
  button.addEventListener("click", async () => {
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


// Guided, one-section-at-a-time presentation.
const slides = Array.from(document.querySelectorAll("main > section"));
let activeSlide = 0;
let navigationLocked = false;
let touchStartY = 0;
const slideNav = document.createElement("nav");
slideNav.className = "slide-nav";
slideNav.setAttribute("aria-label", "Story navigation");
slideNav.innerHTML = `
  <button type="button" class="slide-nav-button" data-direction="-1" aria-label="Previous section">← <span>Back</span></button>
  <span class="slide-progress" aria-live="polite">01 / 08</span>
  <button type="button" class="slide-nav-button slide-next" data-direction="1">Next <span aria-hidden="true">→</span></button>
`;
document.body.append(slideNav);

function goToSlide(index) {
  const nextIndex = Math.max(0, Math.min(slides.length - 1, index));
  if (nextIndex === activeSlide && window.scrollY < 5) return;
  activeSlide = nextIndex;
  navigationLocked = true;
  slides[activeSlide].scrollIntoView({ behavior: "smooth", block: "start" });
  slideNav.querySelector(".slide-progress").textContent =
    `${String(activeSlide + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
  const back = slideNav.querySelector('[data-direction="-1"]');
  const next = slideNav.querySelector('[data-direction="1"]');
  back.disabled = activeSlide === 0;
  next.disabled = activeSlide === slides.length - 1;
  window.setTimeout(() => { navigationLocked = false; }, 750);
}
slideNav.addEventListener("click", (event) => {
  const button = event.target.closest("[data-direction]");
  if (button && !button.disabled) goToSlide(activeSlide + Number(button.dataset.direction));
});
slides.forEach((slide, index) => {
  slide.dataset.slideIndex = String(index);
});
const slideObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting && entry.intersectionRatio > 0.55) {
      activeSlide = Number(entry.target.dataset.slideIndex);
      slideNav.querySelector(".slide-progress").textContent =
        `${String(activeSlide + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
      slideNav.querySelector('[data-direction="-1"]').disabled = activeSlide === 0;
      slideNav.querySelector('[data-direction="1"]').disabled = activeSlide === slides.length - 1;
    }
  });
}, { threshold: [0.55] });
slides.forEach((slide) => slideObserver.observe(slide));

let lastWheelAt = 0;
window.addEventListener("wheel", (event) => {
  if (Math.abs(event.deltaY) < 12 || navigationLocked) return;
  event.preventDefault();
  const now = Date.now();
  if (now - lastWheelAt < 850) return;
  lastWheelAt = now;
  goToSlide(activeSlide + (event.deltaY > 0 ? 1 : -1));
}, { passive: false });

window.addEventListener("touchstart", (event) => {
  touchStartY = event.changedTouches[0]?.screenY || 0;
}, { passive: true });
window.addEventListener("touchend", (event) => {
  if (navigationLocked) return;
  const endY = event.changedTouches[0]?.screenY || 0;
  const distance = touchStartY - endY;
  if (Math.abs(distance) > 55) goToSlide(activeSlide + (distance > 0 ? 1 : -1));
}, { passive: true });

window.addEventListener("keydown", (event) => {
  if (["ArrowDown", "PageDown", " "].includes(event.key) && !["TEXTAREA", "INPUT"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    goToSlide(activeSlide + 1);
  } else if (["ArrowUp", "PageUp"].includes(event.key)) {
    event.preventDefault();
    goToSlide(activeSlide - 1);
  }
});
