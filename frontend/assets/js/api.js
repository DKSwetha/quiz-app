const API_BASE = "http://localhost:8000";
window.API_BASE = API_BASE;

async function apiFetch(path, options = {}) {
  const { headers, ...rest } = options;
  let res;

  try {
    const bucket = getUser ? getUser() : null;
    const authHeader = bucket && bucket.access_token ? { Authorization: `Bearer ${bucket.access_token}` } : {};

    res = await fetch(API_BASE + path, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(headers || {}),
        ...authHeader,
      },
    });
  } catch (error) {
    throw new Error("Cannot reach the server. Is the backend running?");
  }

  let data = null;
  try {
    data = await res.json();
  } catch (error) {
    // response had no JSON body
  }

  if (!res.ok) {
    const message = data && typeof data.detail === "string" ? data.detail : "Something went wrong";
    throw new Error(message);
  }

  return data;
}

window.apiFetch = apiFetch;
window.apiGet = (path) => apiFetch(path);
window.apiPost = (path, body) => apiFetch(path, { method: "POST", body: JSON.stringify(body) });
window.apiPut = (path, body) => apiFetch(path, { method: "PUT", body: JSON.stringify(body) });
window.apiDelete = (path) => apiFetch(path, { method: "DELETE" });
