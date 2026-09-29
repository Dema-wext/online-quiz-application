const app = document.querySelector("#app");
const accountNav = document.querySelector("#account-nav");
const letters = ["A", "B", "C", "D"];
const state = { user: null, questions: [], current: 0, answers: {}, view: "login", message: "" };

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

async function api(action, { method = "GET", body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["X-CSRF-Token"] = state.csrfToken || "";
  const response = await fetch(`api.php?action=${encodeURIComponent(action)}`, {
    method,
    credentials: "same-origin",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let result;
  try {
    result = await response.json();
  } catch {
    result = {};
  }
  if (result.csrfToken) state.csrfToken = result.csrfToken;
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}

function takeMessage() {
  const message = state.message;
  state.message = "";
  return message ? `<p class="form-message" role="alert">${escapeHtml(message)}</p>` : "";
}

function renderNav() {
  if (!state.user) {
    accountNav.innerHTML = "";
    return;
  }
  accountNav.innerHTML = `
    <span class="account-name">${escapeHtml(state.user.name)}</span>
    <button class="nav-button" data-view="history">My results</button>
    ${state.user.role === "admin" ? '<button class="nav-button" data-view="admin">Manage quiz</button>' : ""}
    <button class="nav-button" data-action="logout">Log out</button>`;
}

function renderAuth(mode = "login") {
  state.view = mode;
  renderNav();
  const registering = mode === "register";
  app.innerHTML = `
    <section class="auth-wrap screen-enter" aria-labelledby="auth-title">
      <p class="eyebrow">QuickQuiz · General knowledge</p>
      <h1 id="auth-title">${registering ? "Create your account." : "Welcome back."}</h1>
      <p class="auth-intro">${registering ? "Your quiz results will be saved to your account." : "Log in to take a quiz and see your saved results."}</p>
      ${takeMessage()}
      <form class="auth-form" data-mode="${mode}">
        ${registering ? '<label>Your name<input name="name" autocomplete="name" maxlength="80" required></label>' : ""}
        <label>Email address<input type="email" name="email" autocomplete="email" maxlength="254" required></label>
        <label>Password<input type="password" name="password" autocomplete="${registering ? "new-password" : "current-password"}" minlength="8" maxlength="72" required></label>
        <button class="button button-primary" type="submit">${registering ? "Create account" : "Log in"}</button>
      </form>
      <p class="auth-switch">${registering ? "Already registered?" : "New to QuickQuiz?"} <button class="text-button" data-view="${registering ? "login" : "register"}">${registering ? "Log in" : "Create an account"}</button></p>
    </section>`;
}

async function openQuiz() {
  state.view = "quiz";
  renderNav();
  try {
    const result = await api("questions");
    state.questions = result.questions;
    state.current = 0;
    state.answers = {};
    renderQuiz();
  } catch (error) {
    state.message = error.message;
    renderQuiz();
  }
}

function renderQuiz() {
  state.view = "quiz";
  renderNav();
  if (!state.questions.length) {
    app.innerHTML = `<section class="screen-enter"><p class="eyebrow">QuickQuiz</p><h1>No questions yet.</h1><p class="intro-note">An administrator can add questions in the quiz manager.</p>${takeMessage()}</section>`;
    return;
  }

  const question = state.questions[state.current];
  const progress = state.questions.map((_, index) => `<span class="progress-segment ${index < state.current ? "done" : ""} ${index === state.current ? "current" : ""}" aria-hidden="true"></span>`).join("");
  const options = question.options.map((option, index) => {
    const letter = letters[index];
    return `<label class="option">
      <input type="radio" name="answer" value="${letter}" ${state.answers[question.id] === letter ? "checked" : ""} aria-label="${letter}: ${escapeHtml(option)}">
      <span class="option-letter" aria-hidden="true">${letter}</span>
      <span class="option-text">${escapeHtml(option)}</span>
    </label>`;
  }).join("");

  app.innerHTML = `
    <section class="screen-enter" aria-labelledby="page-title">
      ${takeMessage()}
      <div class="intro">
        <div><p class="eyebrow">The quick quiz · General knowledge</p><h1 id="page-title">A little bit of<br>everything.</h1></div>
        <p class="intro-note">Answer the questions and your score will be saved to your account.</p>
      </div>
      <div class="quiz-layout">
        <section class="quiz-main" aria-label="Quiz question">
          <div class="progress-head"><span>QUESTION ${String(state.current + 1).padStart(2, "0")} <span class="sr-only">of ${state.questions.length}</span></span><span>${state.current + 1} / ${state.questions.length}</span></div>
          <div class="progress-track" style="grid-template-columns: repeat(${state.questions.length}, minmax(0, 1fr))" role="progressbar" aria-label="Quiz progress" aria-valuemin="1" aria-valuemax="${state.questions.length}" aria-valuenow="${state.current + 1}">${progress}</div>
          <div class="question-meta">${escapeHtml(question.topic)}</div>
          <h2 class="question" id="question-text" tabindex="-1">${escapeHtml(question.question)}</h2>
          <fieldset class="options" aria-labelledby="question-text" style="border:0;padding:0;margin:0">
            <legend class="sr-only">Choose one answer</legend>${options}
          </fieldset>
          <div class="question-nav">
            <button class="button button-quiet" data-action="previous" ${state.current === 0 ? "disabled" : ""}>← <span>Previous</span></button>
            ${state.current < state.questions.length - 1
              ? '<button class="button button-primary" data-action="next">Next question <span aria-hidden="true">→</span></button>'
              : '<button class="button button-primary" data-action="finish">Finish quiz <span aria-hidden="true">↗</span></button>'}
          </div>
        </section>
        <aside class="side-panel" aria-label="Quiz information">
          <h2 class="side-title">Your run</h2>
          <div class="stat-row"><span>Questions</span><strong>${state.questions.length}</strong></div>
          <div class="stat-row"><span>Answered</span><strong id="answered-count">${Object.keys(state.answers).length} / ${state.questions.length}</strong></div>
          <blockquote class="side-callout">“The more that you read, the more things you will know.”<span>Dr. Seuss</span></blockquote>
        </aside>
      </div>
    </section>`;
}

function renderAttempt(attempt, saved = true) {
  state.view = "result";
  const score = Number(attempt.score);
  const total = Number(attempt.total_questions);
  const percentage = total ? Math.round(score / total * 100) : 0;
  const review = attempt.answers.map((answer, index) => {
    const options = answer.options.map((option, optionIndex) => {
      const letter = letters[optionIndex];
      const correct = letter === answer.correct_option;
      const selected = letter === answer.selected_option;
      const status = correct && selected ? "Your answer · Correct" : correct ? "Correct answer" : selected ? "Your answer" : "";
      return `<li class="review-option ${correct ? "correct-option" : ""} ${selected ? "selected-option" : ""}">
        <span class="review-option-letter">${letter}</span><span class="review-option-text">${escapeHtml(option)}</span>${status ? `<span class="review-option-status">${status}</span>` : ""}
      </li>`;
    }).join("");
    const correct = answer.selected_option === answer.correct_option;
    const status = answer.selected_option === null ? "Skipped" : correct ? "Correct" : "Review";
    return `<article class="review-item ${answer.selected_option === null ? "" : correct ? "correct" : "incorrect"}">
      <span class="review-mark" aria-hidden="true">${answer.selected_option === null ? "–" : correct ? "✓" : "×"}</span>
      <div><h3 class="review-question">${String(index + 1).padStart(2, "0")}. ${escapeHtml(answer.question_text)}</h3><ul class="review-options">${options}</ul></div>
      <span class="review-tag">${status}</span>
    </article>`;
  }).join("");
  const unanswered = attempt.answers.filter(answer => answer.selected_option === null).length;
  const incorrect = total - score - unanswered;
  app.innerHTML = `<section class="result-wrap screen-enter" aria-labelledby="result-title">
    <div class="result-heading"><div><p class="eyebrow">${saved ? "Saved result" : "Your result"}</p><h1 id="result-title">${percentage >= 70 ? "Nicely done." : "Good first round."}</h1><p class="result-date">${escapeHtml(formatDate(attempt.created_at))}</p></div><div class="score-stamp" aria-label="${percentage} percent"><strong>${percentage}%</strong><span>Your score</span></div></div>
    <div class="result-summary" aria-label="Score breakdown"><div class="result-stat"><strong>${score} / ${total}</strong><span>Correct</span></div><div class="result-stat"><strong>${incorrect}</strong><span>Incorrect</span></div><div class="result-stat"><strong>${unanswered}</strong><span>Skipped</span></div></div>
    <h2 class="review-title">The answer sheet</h2><div class="review-list">${review}</div>
    <div class="result-actions"><button class="button" data-view="history">My results</button><button class="button button-primary" data-action="retry">Try again <span aria-hidden="true">↻</span></button></div>
  </section>`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

async function finishQuiz() {
  const answers = Object.fromEntries(state.questions.map(question => [question.id, state.answers[question.id] || null]));
  try {
    const result = await api("submit", { method: "POST", body: { answers } });
    const saved = await api(`attempt&id=${result.attemptId}`);
    renderAttempt(saved.attempt);
  } catch (error) {
    state.message = error.message;
    renderQuiz();
  }
}

async function renderHistory() {
  state.view = "history";
  renderNav();
  try {
    const result = await api("history");
    const rows = result.attempts.map(attempt => `<tr>
      <td>${escapeHtml(formatDate(attempt.created_at))}</td>
      <td>${escapeHtml(attempt.score)} / ${escapeHtml(attempt.total_questions)}</td>
      <td><button class="text-button" data-action="view-attempt" data-id="${Number(attempt.id)}">Review</button></td>
    </tr>`).join("");
    app.innerHTML = `<section class="screen-enter" aria-labelledby="page-title"><p class="eyebrow">Your account</p><h1 id="page-title">Previous results.</h1><p class="intro-note">Your completed quiz attempts, newest first.</p>${takeMessage()}
      ${rows ? `<div class="table-scroll"><table class="history-table"><thead><tr><th>Date</th><th>Score</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="empty-state">No saved results yet. Take a quiz to see it here.</p>'}
      <button class="button button-primary" data-action="retry">Take a quiz</button></section>`;
  } catch (error) {
    state.message = error.message;
    app.innerHTML = `<section><h1>Previous results.</h1>${takeMessage()}</section>`;
  }
}

function questionForm(question = null) {
  const id = question ? Number(question.id) : "";
  const values = question ? [question.option_a, question.option_b, question.option_c, question.option_d] : ["", "", "", ""];
  const correct = question?.correct_option || "A";
  return `<form class="question-form" data-id="${id}">
    <label>Question<input name="question" maxlength="500" value="${escapeHtml(question?.question_text || "")}" required></label>
    <label>Topic<input name="topic" maxlength="80" value="${escapeHtml(question?.topic || "")}" required></label>
    <div class="admin-options">${values.map((value, index) => `<label>Option ${letters[index]}<input name="option${letters[index]}" maxlength="255" value="${escapeHtml(value)}" required></label>`).join("")}</div>
    <label>Correct answer<select name="correctOption">${letters.map(letter => `<option value="${letter}" ${letter === correct ? "selected" : ""}>${letter}</option>`).join("")}</select></label>
    <label>Order<input type="number" name="sortOrder" min="0" value="${escapeHtml(question?.sort_order ?? 0)}"></label>
    <div class="admin-form-actions"><button class="button button-primary" type="submit">${question ? "Save changes" : "Add question"}</button>${question ? `<button class="button" type="button" data-action="delete-question" data-id="${id}">Delete</button>` : ""}</div>
  </form>`;
}

async function renderAdmin() {
  if (state.user?.role !== "admin") return;
  state.view = "admin";
  renderNav();
  try {
    const result = await api("admin-questions");
    const topics = new Set(result.questions.map(question => question.topic)).size;
    const items = result.questions.map((question, index) => `<details class="admin-question" data-search="${escapeHtml(`${question.question_text} ${question.topic}`.toLowerCase())}">
      <summary><span class="admin-question-number">${String(index + 1).padStart(2, "0")}</span><span class="admin-question-summary"><strong>${escapeHtml(question.question_text)}</strong><small>${escapeHtml(question.topic)}</small></span><span class="admin-summary-action">Edit</span></summary>
      <div class="admin-question-editor">${questionForm(question)}</div>
    </details>`).join("");
    app.innerHTML = `<section class="admin-page screen-enter" aria-labelledby="page-title">
      <div class="admin-heading"><div><p class="eyebrow">Administrator</p><h1 id="page-title">Question bank.</h1><p class="intro-note">Create and maintain the questions in your quiz.</p></div><span class="admin-role">Admin workspace</span></div>
      ${takeMessage()}
      <div class="admin-metrics" aria-label="Question bank summary"><div><span>Active questions</span><strong>${result.questions.length}</strong></div><div><span>Topics</span><strong>${topics}</strong></div><div><span>Answer format</span><strong>4 choices</strong></div></div>
      <details class="admin-add-panel"><summary><span><strong>Add a question</strong><small>Create a new question for future quiz attempts.</small></span><span class="admin-add-icon" aria-hidden="true">+</span></summary><div class="admin-add-content">${questionForm()}</div></details>
      <div class="admin-list-heading"><div><h2>Question list</h2><p>Expand a question to edit or archive it.</p></div><label class="admin-search"><span class="sr-only">Search questions</span><input id="question-search" type="search" placeholder="Search questions or topics"></label></div>
      <p class="admin-list-count" id="question-count">${result.questions.length} ${result.questions.length === 1 ? "question" : "questions"}</p>
      <div class="admin-question-list">${items || '<p class="empty-state">No active questions yet. Add your first question above.</p>'}<p class="empty-state filter-empty" hidden>No questions match that search.</p></div>
    </section>`;
  } catch (error) {
    state.message = error.message;
    app.innerHTML = `<section><h1>Manage questions.</h1>${takeMessage()}</section>`;
  }
}

app.addEventListener("change", event => {
  if (event.target.matches('input[name="answer"]')) {
    const question = state.questions[state.current];
    state.answers[question.id] = event.target.value;
    const answeredCount = app.querySelector("#answered-count");
    if (answeredCount) answeredCount.textContent = `${Object.keys(state.answers).length} / ${state.questions.length}`;
  }
});

app.addEventListener("input", event => {
  if (event.target.id !== "question-search") return;
  const query = event.target.value.trim().toLowerCase();
  const questions = [...app.querySelectorAll(".admin-question")];
  let visibleCount = 0;
  for (const question of questions) {
    const matches = question.dataset.search.includes(query);
    question.hidden = !matches;
    if (matches) visibleCount += 1;
  }
  const count = app.querySelector("#question-count");
  if (count) count.textContent = query ? `${visibleCount} of ${questions.length} questions` : `${questions.length} ${questions.length === 1 ? "question" : "questions"}`;
  const empty = app.querySelector(".filter-empty");
  if (empty) empty.hidden = visibleCount !== 0 || questions.length === 0;
});

app.addEventListener("click", async event => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    if (viewButton.dataset.view === "history") await renderHistory();
    else if (viewButton.dataset.view === "admin") await renderAdmin();
    else renderAuth(viewButton.dataset.view);
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  switch (button.dataset.action) {
    case "previous":
      state.current = Math.max(0, state.current - 1);
      renderQuiz();
      break;
    case "next":
      state.current = Math.min(state.questions.length - 1, state.current + 1);
      renderQuiz();
      break;
    case "finish":
      button.disabled = true;
      await finishQuiz();
      break;
    case "retry":
      await openQuiz();
      break;
    case "view-attempt": {
      try {
        const result = await api(`attempt&id=${button.dataset.id}`);
        renderAttempt(result.attempt);
      } catch (error) {
        state.message = error.message;
        await renderHistory();
      }
      break;
    }
    case "delete-question":
      if (window.confirm("Archive this question? It will no longer appear in new quizzes.")) {
        try {
          await api("admin-delete", { method: "POST", body: { id: Number(button.dataset.id) } });
          state.message = "Question archived.";
          await renderAdmin();
        } catch (error) {
          state.message = error.message;
          await renderAdmin();
        }
      }
      break;
    case "logout":
      try {
        await api("logout", { method: "POST", body: {} });
      } finally {
        state.user = null;
        renderAuth("login");
      }
      break;
  }
});

app.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.target;
  if (form.matches(".auth-form")) {
    const values = Object.fromEntries(new FormData(form));
    try {
      const result = await api(form.dataset.mode === "register" ? "register" : "login", { method: "POST", body: values });
      state.user = result.user;
      await openQuiz();
    } catch (error) {
      state.message = error.message;
      renderAuth(form.dataset.mode);
    }
    return;
  }
  if (form.matches(".question-form")) {
    const values = new FormData(form);
    const body = {
      question: values.get("question"),
      topic: values.get("topic"),
      options: letters.map(letter => values.get(`option${letter}`)),
      correctOption: values.get("correctOption"),
      sortOrder: Number(values.get("sortOrder")) || 0
    };
    if (form.dataset.id) body.id = Number(form.dataset.id);
    try {
      const result = await api("admin-save", { method: "POST", body });
      state.message = result.message;
      await renderAdmin();
    } catch (error) {
      state.message = error.message;
      await renderAdmin();
    }
  }
});

accountNav.addEventListener("click", async event => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    if (viewButton.dataset.view === "history") await renderHistory();
    else await renderAdmin();
    return;
  }
  const logoutButton = event.target.closest('[data-action="logout"]');
  if (logoutButton) {
    try {
      await api("logout", { method: "POST", body: {} });
    } finally {
      state.user = null;
      renderAuth("login");
    }
  }
});

document.querySelector("#home-link").addEventListener("click", event => {
  event.preventDefault();
  if (state.user) openQuiz();
  else renderAuth("login");
});

async function initialize() {
  try {
    const result = await api("session");
    state.user = result.user;
    if (state.user) await openQuiz();
    else renderAuth("login");
  } catch (error) {
    state.message = error.message;
    renderAuth("login");
  }
}

initialize();
