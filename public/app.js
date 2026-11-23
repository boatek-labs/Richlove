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
    document.querySelector(".proposal")?.classList.add("has-response");
    document.querySelector(".proposal-content")?.classList.add("panel-hidden");
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
      document.querySelector(".proposal")?.classList.add("has-response");
      document.querySelector(".proposal-content")?.classList.add("panel-hidden");
      responseFeedback.textContent = "";
      if (choice === "yes") afterYes.classList.remove("panel-hidden");
      if (choice === "time") afterTime.classList.remove("panel-hidden");
      if (choice === "no") afterNo.classList.remove("panel-hidden");

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



// Locked horizontal presentation: every chapter is a viewport-sized slide.
const slides = Array.from(document.querySelectorAll("#top > section"));
const track = document.getElementById("top");
let activeSlide = 0;
let locked = false;
let pointerStart = null;

const nav = document.createElement("nav");
nav.className = "story-controls";
nav.setAttribute("aria-label", "Story controls");
nav.innerHTML = `
  <button type="button" class="story-control back" data-step="-1" aria-label="Previous slide">← <span>Back</span></button>
  <span class="story-count" aria-live="polite">01 / ${String(slides.length).padStart(2,"0")}</span>
  <button type="button" class="story-control next" data-step="1"><span>Next</span> <b aria-hidden="true">→</b></button>
`;
document.body.append(nav);

function updateControls() {
  nav.querySelector(".story-count").textContent =
    `${String(activeSlide+1).padStart(2,"0")} / ${String(slides.length).padStart(2,"0")}`;
  nav.querySelector(".back").disabled = activeSlide === 0;
  const next = nav.querySelector(".next");
  next.disabled = activeSlide === slides.length - 1;
  next.querySelector("span").textContent = activeSlide === 0 ? "Take a look" :
    activeSlide === slides.length - 1 ? "Finished" : "Next";
}
function goToSlide(index) {
  const target = Math.max(0, Math.min(slides.length-1,index));
  if (target === activeSlide || locked) return;
  activeSlide = target;
  locked = true;
  slides.forEach((slide,i) => { slide.style.transform = `translate3d(${(i-activeSlide)*100}vw,0,0)`; });
  slides.forEach((slide,i) => slide.setAttribute("aria-hidden", i === activeSlide ? "false" : "true"));
  slides[activeSlide].querySelectorAll(".reveal").forEach(el => el.classList.add("is-visible"));
  updateControls();
  window.setTimeout(() => { locked = false; }, 560);
}
nav.addEventListener("click", e => {
  const button=e.target.closest("[data-step]");
  if(button && !button.disabled) goToSlide(activeSlide+Number(button.dataset.step));
});
document.querySelector(".hero-copy .button")?.addEventListener("click", e => {
  e.preventDefault();
  goToSlide(1);
});
slides.forEach((slide,i) => {
  slide.setAttribute("aria-hidden", i === 0 ? "false" : "true");
  slide.dataset.slideIndex=String(i);
});
slides[0]?.querySelectorAll(".reveal").forEach(el=>el.classList.add("is-visible"));
updateControls();

track.addEventListener("pointerdown", e => {
  if(e.pointerType === "mouse" || e.target.closest("button,a,input,textarea")) return;
  pointerStart={x:e.clientX,y:e.clientY};
});
track.addEventListener("pointerup", e => {
  if(!pointerStart) return;
  const dx=e.clientX-pointerStart.x, dy=e.clientY-pointerStart.y;
  pointerStart=null;
  if(Math.abs(dx)>65 && Math.abs(dx)>Math.abs(dy)*1.25) goToSlide(activeSlide+(dx<0?1:-1));
});
window.addEventListener("keydown", e => {
  if(["INPUT","TEXTAREA"].includes(document.activeElement.tagName)) return;
  if(["ArrowRight","PageDown"].includes(e.key)) { e.preventDefault(); goToSlide(activeSlide+1); }
  if(["ArrowLeft","PageUp"].includes(e.key)) { e.preventDefault(); goToSlide(activeSlide-1); }
});
