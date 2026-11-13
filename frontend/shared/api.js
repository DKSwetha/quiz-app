// Shared by the admin and member portals.
// Agree with your teammate before changing anything in this file.

const API_BASE = "http://localhost:8000";

// ---------- Generic request helper ----------
async function apiFetch(path, options = {}) {
  const { headers, ...rest } = options;
  const authUser = getUser && getUser();
  const authHeader = authUser && authUser.access_token ? { Authorization: `Bearer ${authUser.access_token}` } : {};

  let res;
  try {
    res = await fetch(API_BASE + path, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(headers || {}),
        ...authHeader,
      },
    });
  } catch (err) {
    throw new Error("Cannot reach the server. Is the backend running?");
  }

  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    // response had no JSON body
  }

  if (!res.ok) {
    let message = "Something went wrong";
    if (data && typeof data.detail === "string") {
      message = data.detail;
    } else if (data && Array.isArray(data.detail)) {
      message = "Please check the values you entered";
    }
    throw new Error(message);
  }
  return data;
}

const apiGet = (path) => apiFetch(path);
const apiPost = (path, body) => apiFetch(path, { method: "POST", body: JSON.stringify(body) });
const apiPut = (path, body) => apiFetch(path, { method: "PUT", body: JSON.stringify(body) });
const apiDelete = (path) => apiFetch(path, { method: "DELETE" });

// ---------- Logged-in user (kept in the browser) ----------
function saveUser(user) {
  localStorage.setItem("quizUser", JSON.stringify(user));
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("quizUser"));
  } catch (err) {
    return null;
  }
}

function clearUser() {
  localStorage.removeItem("quizUser");
}

// ---------- Login / logout / page guard ----------
function loginRequest(email, password) {
  return apiPost("/auth/login", { email, password });
}

// Call at the top of every protected page, e.g. requireRole("admin", "login.html")
function requireRole(role, loginPage) {
  const user = getUser();
  if (!user || user.role !== role) {
    window.location.href = loginPage;
    return null;
  }
  return user;
}

function logout(loginPage) {
  clearUser();
  window.location.href = loginPage;
}

// ---------- Small UI helper ----------
function showAlert(elementId, message, type = "danger") {
  const box = document.getElementById(elementId);
  box.className = "alert alert-" + type;
  box.textContent = message;
  box.classList.remove("d-none");
}
