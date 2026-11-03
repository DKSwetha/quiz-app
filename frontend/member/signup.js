

const signupForm = document.getElementById("signupForm");

const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");

const signupBtn = document.getElementById("signupBtn");
const messageBox = document.getElementById("message");



function showMessage(message, type) {
    messageBox.textContent = message;
    messageBox.className = type;
    messageBox.style.display = "block";
}



function isValidEmail(email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
}



signupForm.addEventListener("submit", async function (event) {

    event.preventDefault();


    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;


    if (name.length < 2) {
        showMessage("Please enter a valid name.", "error");
        return;
    }


    if (!isValidEmail(email)) {
        showMessage("Please enter a valid email address.", "error");
        return;
    }


    if (password.length < 8) {
        showMessage("Password must contain at least 8 characters.", "error");
        return;
    }


    if (new TextEncoder().encode(password).length > 72) {
        showMessage("Password must not exceed 72 bytes.", "error");
        return;
    }


    if (password !== confirmPassword) {
        showMessage("Passwords do not match.", "error");
        return;
    }


    signupBtn.disabled = true;
    signupBtn.textContent = "Registering...";

    try {


        const response = await apiPost("/auth/register", {
            name: name,
            email: email,
            password: password
        });

        showMessage(
            "Registration successful! You can now log in.",
            "success"
        );


        signupForm.reset();

    } catch (error) {


        showMessage(error.message, "error");

    } finally {


        signupBtn.disabled = false;
        signupBtn.textContent = "Sign Up";
    }
});
