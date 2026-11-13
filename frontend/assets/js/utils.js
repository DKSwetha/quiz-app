function showAlert(elementId, message, type = "danger") {
  const box = document.getElementById(elementId);
  if (!box) return;
  box.className = `alert alert-${type}`;
  box.textContent = message;
  box.classList.remove("d-none");
}

function formatDate(value) {
  if (!value) return "--";
  return new Date(value).toLocaleString();
}

window.showAlert = showAlert;
window.formatDate = formatDate;
