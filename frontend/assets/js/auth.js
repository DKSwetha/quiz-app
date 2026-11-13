function saveUser(user) {
  localStorage.setItem("quizUser", JSON.stringify(user));
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("quizUser"));
  } catch (error) {
    return null;
  }
}

function clearUser() {
  localStorage.removeItem("quizUser");
}

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

window.saveUser = saveUser;
window.getUser = getUser;
window.clearUser = clearUser;
window.requireRole = requireRole;
window.logout = logout;
