

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");



loginForm.addEventListener("submit", async function (event) {


    event.preventDefault();


    const email = emailInput.value.trim();
    const password = passwordInput.value;


    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in...";


    const alertBox = document.getElementById("alertBox");
    alertBox.className = "alert d-none";
    alertBox.textContent = "";

    try {


        const user = await loginRequest(email, password);


        if (user.role !== "member") {
            throw new Error(
                "This page is for members only. Please use the admin login."
            );
        }


        saveUser(user);


        showAlert(
            "alertBox",
            "Login successful! Your member account is verified.",
            "success"
        );

        // The member dashboard has not been created yet.
        // Add the dashboard redirect here when that page is ready.
        window.location.href = "dashboard.html";

    } catch (error) {

        // Display backend or validation error
        showAlert("alertBox", error.message, "danger");

    } finally {


        loginBtn.disabled = false;
        loginBtn.textContent = "Login";
    }
});
