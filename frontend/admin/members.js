const admin = requireRole("admin", "login.html");

let members = [];
let searchTimer = null;

const memberModal = new bootstrap.Modal(document.getElementById("memberModal"));
const uploadModal = new bootstrap.Modal(document.getElementById("uploadModal"));

// Always escape text that came from the database before putting it in HTML.
function esc(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

// ---------- Loading ----------
async function loadBatches() {
  try {
    const batches = await apiGet("/admin/members/batches");
    const filter = document.getElementById("batchFilter");
    const current = filter.value;
    filter.innerHTML = '<option value="">All batches</option>' +
      batches.map((b) => `<option value="${esc(b)}">${esc(b)}</option>`).join("");
    filter.value = batches.includes(current) ? current : "";
    document.getElementById("batchList").innerHTML =
      batches.map((b) => `<option value="${esc(b)}">`).join("");
  } catch (err) {
    showAlert("pageAlert", err.message);
  }
}

async function loadMembers() {
  const params = new URLSearchParams();
  const search = document.getElementById("searchInput").value.trim();
  const batch = document.getElementById("batchFilter").value;
  const status = document.getElementById("statusFilter").value;
  if (search) params.set("search", search);
  if (batch) params.set("batch", batch);
  if (status) params.set("status", status);

  try {
    members = await apiGet("/admin/members?" + params.toString());
    renderMembers();
  } catch (err) {
    showAlert("pageAlert", err.message);
  }
}

function renderMembers() {
  const body = document.getElementById("membersBody");
  if (members.length === 0) {
    body.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No members found</td></tr>';
  } else {
    body.innerHTML = members.map((m) => `
      <tr>
        <td>${esc(m.name)}</td>
        <td>${esc(m.email)}</td>
        <td>${esc(m.batch || "-")}</td>
        <td>${m.is_active
          ? '<span class="badge bg-success">Active</span>'
          : '<span class="badge bg-secondary">Deactivated</span>'}</td>
        <td>${m.password_set
          ? '<span class="badge bg-primary">Set</span>'
          : '<span class="badge bg-warning text-dark">Not set</span>'}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${m.id}">Edit</button>
          <button class="btn btn-sm ${m.is_active ? "btn-outline-danger" : "btn-outline-success"}"
                  data-action="toggle" data-id="${m.id}">${m.is_active ? "Deactivate" : "Activate"}</button>
        </td>
      </tr>`).join("");
  }
  document.getElementById("countText").textContent = members.length + " member(s) shown";
}

// ---------- Add / edit ----------
function openAdd() {
  document.getElementById("memberForm").reset();
  document.getElementById("memberId").value = "";
  document.getElementById("memberModalTitle").textContent = "Add member";
  document.getElementById("modalAlert").classList.add("d-none");
  memberModal.show();
}

function openEdit(id) {
  const m = members.find((x) => x.id === id);
  if (!m) return;
  document.getElementById("memberId").value = m.id;
  document.getElementById("mName").value = m.name;
  document.getElementById("mEmail").value = m.email;
  document.getElementById("mBatch").value = m.batch || "";
  document.getElementById("memberModalTitle").textContent = "Edit member";
  document.getElementById("modalAlert").classList.add("d-none");
  memberModal.show();
}

document.getElementById("memberForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("memberSaveBtn");
  btn.disabled = true;

  const id = document.getElementById("memberId").value;
  const body = {
    name: document.getElementById("mName").value.trim(),
    email: document.getElementById("mEmail").value.trim(),
    batch: document.getElementById("mBatch").value.trim() || null,
  };

  try {
    if (id) {
      await apiPut("/admin/members/" + id, body);
    } else {
      await apiPost("/admin/members", body);
    }
    memberModal.hide();
    showAlert("pageAlert", id ? "Member updated" : "Member added", "success");
    await Promise.all([loadMembers(), loadBatches()]);
  } catch (err) {
    showAlert("modalAlert", err.message);
  } finally {
    btn.disabled = false;
  }
});

// ---------- Activate / deactivate ----------
async function toggleActive(id) {
  const m = members.find((x) => x.id === id);
  if (!m) return;
  const verb = m.is_active ? "deactivate" : "activate";
  if (!confirm(`Do you want to ${verb} ${m.name}?`)) return;

  try {
    await apiFetch(`/admin/members/${id}/active`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: !m.is_active }),
    });
    showAlert("pageAlert", `${m.name} ${m.is_active ? "deactivated" : "activated"}`, "success");
    await loadMembers();
  } catch (err) {
    showAlert("pageAlert", err.message);
  }
}

document.getElementById("membersBody").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  if (btn.dataset.action === "edit") openEdit(id);
  if (btn.dataset.action === "toggle") toggleActive(id);
});

// ---------- CSV upload ----------
document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = document.getElementById("csvFile").files[0];
  if (!file) return;

  const btn = document.getElementById("uploadBtn");
  btn.disabled = true;
  btn.textContent = "Uploading...";
  document.getElementById("uploadAlert").classList.add("d-none");
  document.getElementById("uploadResult").innerHTML = "";

  const form = new FormData();
  form.append("file", file);

  try {
    // No Content-Type header here: the browser sets it for file uploads.
    const res = await fetch(API_BASE + "/admin/members/upload-csv", { method: "POST", body: form });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data && typeof data.detail === "string" ? data.detail : "Upload failed");
    }

    let html = `<div class="alert alert-success mb-2">${data.created} member(s) added.</div>`;
    if (data.skipped.length) {
      html += `<p class="mb-1"><strong>${data.skipped.length} skipped (email already exists):</strong></p><ul>` +
        data.skipped.map((s) => `<li>Row ${s.row}: ${esc(s.email)}</li>`).join("") + "</ul>";
    }
    if (data.errors.length) {
      html += `<p class="mb-1"><strong>${data.errors.length} row(s) had errors:</strong></p><ul>` +
        data.errors.map((er) => `<li>Row ${er.row}: ${esc(er.reason)}</li>`).join("") + "</ul>";
    }
    document.getElementById("uploadResult").innerHTML = html;
    document.getElementById("csvFile").value = "";
    await Promise.all([loadMembers(), loadBatches()]);
  } catch (err) {
    const msg = err instanceof TypeError ? "Cannot reach the server. Is the backend running?" : err.message;
    showAlert("uploadAlert", msg);
  } finally {
    btn.disabled = false;
    btn.textContent = "Upload";
  }
});

document.getElementById("sampleLink").addEventListener("click", (e) => {
  e.preventDefault();
  const csv = "name,email,batch\nAsha Rao,asha@example.com,Batch A\nRavi Kumar,ravi@example.com,Batch A\n";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "sample_members.csv";
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
  searchTimer = setTimeout(loadMembers, 300);
});
document.getElementById("batchFilter").addEventListener("change", loadMembers);
document.getElementById("statusFilter").addEventListener("change", loadMembers);

if (admin) {
  document.getElementById("userName").textContent = admin.name;
  loadBatches();
  loadMembers();
}
