const admin = requireRole("admin", "login.html");

const PAGE_SIZE = 20;
let questions = [];
let page = 1;
let total = 0;
let searchTimer = null;

const questionModal = new bootstrap.Modal(document.getElementById("questionModal"));
const uploadModal = new bootstrap.Modal(document.getElementById("uploadModal"));
const LOCKABLE = ["qText", "oA", "oB", "oC", "oD", "qCorrect", "qMarks"];

// Escape text from the database before putting it into HTML (text and attributes).
function esc(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function difficultyBadge(d) {
  const cls = d === "easy" ? "bg-success" : d === "hard" ? "bg-danger" : "bg-warning text-dark";
  return `<span class="badge ${cls}">${esc(d)}</span>`;
}

// ---------- Loading ----------
async function loadTopics() {
  try {
    const topics = await apiGet("/admin/questions/topics");
    const filter = document.getElementById("topicFilter");
    const current = filter.value;
    filter.innerHTML = '<option value="">All topics</option>' +
      topics.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
    filter.value = topics.includes(current) ? current : "";
    document.getElementById("topicList").innerHTML =
      topics.map((t) => `<option value="${esc(t)}">`).join("");
  } catch (err) {
    showAlert("pageAlert", err.message);
  }
}

async function loadQuestions() {
  const params = new URLSearchParams({ page: page, page_size: PAGE_SIZE });
  const search = document.getElementById("searchInput").value.trim();
  const topic = document.getElementById("topicFilter").value;
  const difficulty = document.getElementById("difficultyFilter").value;
  if (search) params.set("search", search);
  if (topic) params.set("topic", topic);
  if (difficulty) params.set("difficulty", difficulty);

  try {
    const data = await apiGet("/admin/questions?" + params.toString());
    questions = data.items;
    total = data.total;
    // If we deleted the last item on a page, step back one page.
    if (questions.length === 0 && page > 1) {
      page -= 1;
      return loadQuestions();
    }
    renderQuestions();
  } catch (err) {
    showAlert("pageAlert", err.message);
  }
}

function renderQuestions() {
  const body = document.getElementById("questionsBody");
  if (questions.length === 0) {
    body.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No questions found</td></tr>';
  } else {
    body.innerHTML = questions.map((q) => `
      <tr>
        <td class="text-muted">${q.id}</td>
        <td><div class="text-truncate" style="max-width:380px" title="${esc(q.text)}">${esc(q.text)}</div></td>
        <td>${esc(q.topic)}</td>
        <td>${difficultyBadge(q.difficulty)}</td>
        <td>${q.marks}</td>
        <td>${q.locked
          ? '<span class="badge bg-secondary" title="Used in a test">Locked</span>'
          : '<span class="badge bg-light text-dark border">Editable</span>'}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${q.id}">Edit</button>
          <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${q.id}"
                  ${q.locked ? 'disabled title="Used in a test"' : ""}>Delete</button>
        </td>
      </tr>`).join("");
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  document.getElementById("countText").textContent = total + " question(s)";
  document.getElementById("pageText").textContent = `Page ${page} of ${pages}`;
  document.getElementById("prevBtn").disabled = page <= 1;
  document.getElementById("nextBtn").disabled = page >= pages;
}

function reloadFromFirstPage() {
  page = 1;
  loadQuestions();
}

// ---------- Add / edit ----------
function setLocked(locked) {
  LOCKABLE.forEach((id) => { document.getElementById(id).disabled = locked; });
  document.getElementById("lockNote").classList.toggle("d-none", !locked);
}

function openAdd() {
  document.getElementById("questionForm").reset();
  document.getElementById("questionId").value = "";
  document.getElementById("questionModalTitle").textContent = "Add question";
  document.getElementById("modalAlert").classList.add("d-none");
  setLocked(false);
  questionModal.show();
}

function openEdit(id) {
  const q = questions.find((x) => x.id === id);
  if (!q) return;
  document.getElementById("questionForm").reset();
  document.getElementById("questionId").value = q.id;
  document.getElementById("qText").value = q.text;
  document.getElementById("oA").value = q.option_a;
  document.getElementById("oB").value = q.option_b;
  document.getElementById("oC").value = q.option_c;
  document.getElementById("oD").value = q.option_d;
  document.getElementById("qCorrect").value = q.correct_option;
  document.getElementById("qMarks").value = q.marks;
  document.getElementById("qDifficulty").value = q.difficulty;
  document.getElementById("qTopic").value = q.topic;
  document.getElementById("qExplanation").value = q.explanation || "";
  document.getElementById("questionModalTitle").textContent = "Edit question #" + q.id;
  document.getElementById("modalAlert").classList.add("d-none");
  setLocked(q.locked);
  questionModal.show();
}

document.getElementById("questionForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("questionSaveBtn");
  btn.disabled = true;

  const id = document.getElementById("questionId").value;
  const body = {
    text: document.getElementById("qText").value,
    option_a: document.getElementById("oA").value,
    option_b: document.getElementById("oB").value,
    option_c: document.getElementById("oC").value,
    option_d: document.getElementById("oD").value,
    correct_option: document.getElementById("qCorrect").value,
    marks: Number(document.getElementById("qMarks").value),
    difficulty: document.getElementById("qDifficulty").value,
    topic: document.getElementById("qTopic").value,
    explanation: document.getElementById("qExplanation").value || null,
  };

  try {
    if (id) {
      await apiPut("/admin/questions/" + id, body);
    } else {
      await apiPost("/admin/questions", body);
    }
    questionModal.hide();
    showAlert("pageAlert", id ? "Question updated" : "Question added", "success");
    await Promise.all([loadQuestions(), loadTopics()]);
  } catch (err) {
    showAlert("modalAlert", err.message);
  } finally {
    btn.disabled = false;
  }
});

// ---------- Delete ----------
async function deleteQuestion(id) {
  if (!confirm("Delete question #" + id + "? This cannot be undone.")) return;
  try {
    await apiDelete("/admin/questions/" + id);
    showAlert("pageAlert", "Question deleted", "success");
    await Promise.all([loadQuestions(), loadTopics()]);
  } catch (err) {
    showAlert("pageAlert", err.message);
  }
}

document.getElementById("questionsBody").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn || btn.disabled) return;
  const id = Number(btn.dataset.id);
  if (btn.dataset.action === "edit") openEdit(id);
  if (btn.dataset.action === "delete") deleteQuestion(id);
});

// ---------- CSV import ----------
document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = document.getElementById("csvFile").files[0];
  if (!file) return;

  const btn = document.getElementById("uploadBtn");
  btn.disabled = true;
  btn.textContent = "Importing...";
  document.getElementById("uploadAlert").classList.add("d-none");
  document.getElementById("uploadResult").innerHTML = "";

  const form = new FormData();
  form.append("file", file);

  try {
    const res = await fetch(API_BASE + "/admin/questions/upload-csv", { method: "POST", body: form });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data && typeof data.detail === "string" ? data.detail : "Import failed");
    }

    let html = `<div class="alert alert-success mb-2">${data.created} question(s) imported.</div>`;
    if (data.skipped.length) {
      html += `<p class="mb-1"><strong>${data.skipped.length} skipped (already in the bank):</strong></p><ul>` +
        data.skipped.map((s) => `<li>Row ${s.row}: ${esc(s.text)}</li>`).join("") + "</ul>";
    }
    if (data.errors.length) {
      html += `<p class="mb-1"><strong>${data.errors.length} row(s) had errors:</strong></p><ul>` +
        data.errors.map((er) => `<li>Row ${er.row}: ${esc(er.reason)}</li>`).join("") + "</ul>";
    }
    document.getElementById("uploadResult").innerHTML = html;
    document.getElementById("csvFile").value = "";
    page = 1;
    await Promise.all([loadQuestions(), loadTopics()]);
  } catch (err) {
    const msg = err instanceof TypeError ? "Cannot reach the server. Is the backend running?" : err.message;
    showAlert("uploadAlert", msg);
  } finally {
    btn.disabled = false;
    btn.textContent = "Import";
  }
});

document.getElementById("sampleLink").addEventListener("click", (e) => {
  e.preventDefault();
  const csv =
    "text,option_a,option_b,option_c,option_d,correct_option,marks,difficulty,topic,explanation\n" +
    "Which keyword defines a function in Python?,func,def,define,lambda,B,1,easy,Python,def starts a function definition.\n" +
    "Which SQL clause filters rows?,ORDER BY,GROUP BY,WHERE,LIMIT,C,1,easy,SQL,WHERE filters rows before grouping.\n";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "sample_questions.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});

// ---------- Wiring ----------
document.getElementById("openAddBtn").addEventListener("click", openAdd);
document.getElementById("openUploadBtn").addEventListener("click", () => {
  document.getElementById("uploadResult").innerHTML = "";
  document.getElementById("uploadAlert").classList.add("d-none");
  uploadModal.show();
});
document.getElementById("searchInput").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(reloadFromFirstPage, 300);
});
document.getElementById("topicFilter").addEventListener("change", reloadFromFirstPage);
document.getElementById("difficultyFilter").addEventListener("change", reloadFromFirstPage);
document.getElementById("prevBtn").addEventListener("click", () => { page -= 1; loadQuestions(); });
document.getElementById("nextBtn").addEventListener("click", () => { page += 1; loadQuestions(); });

if (admin) {
  document.getElementById("userName").textContent = admin.name;
  loadTopics();
  loadQuestions();
}
