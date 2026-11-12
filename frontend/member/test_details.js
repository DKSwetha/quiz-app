
// Check member login
const user = requireRole("member", "login.html");

if (!user) {
    throw new Error("Member login required");
}

// Display member name
document.getElementById("userName").textContent = user.name;

// Handle logout
document.getElementById("logoutBtn").addEventListener("click", function () {
    logout("login.html");
});
// Read the test ID from the URL
const params = new URLSearchParams(window.location.search);
const testId = params.get("test_id");

// Get page elements
const testDetails = document.getElementById("testDetails");
const startTestBtn = document.getElementById("startTestBtn");

// Store the test information after loading
let currentTest = null;


// Format dates for display
function formatDate(dateValue) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "Not available";
    }

    return date.toLocaleString();
}


// Check whether the test can be started or resumed
function canStartTest(test) {
    const now = new Date();
    const start = new Date(test.start_at);
    const end = new Date(test.end_at);

    const validDates =
        !Number.isNaN(start.getTime()) &&
        !Number.isNaN(end.getTime());

    if (!validDates) {
        return false;
    }

    const validStatus =
        test.status === "assigned" ||
        test.status === "in_progress";

    return validStatus && now >= start && now < end;
}


// Display test information
function displayTestDetails(test) {
    testDetails.replaceChildren();

    const title = document.createElement("h2");
    title.textContent = test.title;

    const instructions = document.createElement("p");
    instructions.textContent =
        test.instructions || "No instructions available.";

    const duration = document.createElement("p");
    duration.textContent =
        `Duration: ${test.duration_minutes} minutes`;

    const marks = document.createElement("p");
    marks.textContent = `Total Marks: ${test.total_marks}`;

    const passPercentage = document.createElement("p");
    passPercentage.textContent =
        `Pass Percentage: ${test.pass_percentage}%`;

    const startDate = document.createElement("p");
    startDate.textContent =
        `Starts: ${formatDate(test.start_at)}`;

    const endDate = document.createElement("p");
    endDate.textContent =
        `Ends: ${formatDate(test.end_at)}`;

    const status = document.createElement("p");
    status.textContent =
        `Status: ${test.status.replace("_", " ")}`;

    testDetails.append(
        title,
        instructions,
        duration,
        marks,
        passPercentage,
        startDate,
        endDate,
        status
    );

    // Update the Start Test button
    updateStartButton(test);
}


// Enable or disable the Start Test button
function updateStartButton(test) {
    if (canStartTest(test)) {
        startTestBtn.disabled = false;

        startTestBtn.textContent =
            test.status === "in_progress"
                ? "Resume Test"
                : "Start Test";

        return;
    }

    startTestBtn.disabled = true;

    const now = new Date();
    const start = new Date(test.start_at);
    const end = new Date(test.end_at);

    if (test.status === "submitted") {
        startTestBtn.textContent = "Test Submitted";
    } else if (test.status === "expired" || now >= end) {
        startTestBtn.textContent = "Test Expired";
    } else if (now < start) {
        startTestBtn.textContent = "Test Not Started";
    } else {
        startTestBtn.textContent = "Unavailable";
    }
}


// Load test details from the backend
async function loadTestDetails() {
    if (
        !testId ||
        !Number.isInteger(Number(testId)) ||
        Number(testId) <= 0
    ) {
        showAlert("testAlert", "Invalid test ID.", "danger");
        startTestBtn.disabled = true;
        return;
    }

    try {
        startTestBtn.disabled = true;
        startTestBtn.textContent = "Loading...";

        const test = await apiGet(
            `/members/${user.user_id}/tests/${testId}`
        );

        currentTest = test;

        displayTestDetails(test);

    } catch (error) {
        console.error("Test details error:", error);

        showAlert(
            "testAlert",
            error.message || "Unable to load test details.",
            "danger"
        );

        startTestBtn.disabled = true;
        startTestBtn.textContent = "Unavailable";
    }
}


// Start a new attempt or resume an existing attempt
async function startTest() {
    if (!currentTest || !canStartTest(currentTest)) {
        showAlert(
            "testAlert",
            "This test is currently unavailable.",
            "warning"
        );
        return;
    }

    try {
        startTestBtn.disabled = true;
        startTestBtn.textContent = "Starting...";

        // Ask the backend to create or resume the attempt
        const attempt = await apiPost(
            `/members/${user.user_id}/tests/${testId}/start`,
            {}
        );

        // Open the test page with the attempt ID
        window.location.href =
            `test.html?test_id=${encodeURIComponent(testId)}` +
            `&attempt_id=${encodeURIComponent(attempt.attempt_id)}`;

    } catch (error) {
        console.error("Start test error:", error);

        showAlert(
            "testAlert",
            error.message || "Unable to start the test.",
            "danger"
        );

        // Allow the member to try again
        startTestBtn.disabled = false;
        startTestBtn.textContent =
            currentTest.status === "in_progress"
                ? "Resume Test"
                : "Start Test";
    }
}


// Attach the click event
startTestBtn.addEventListener("click", startTest);


// Load the page
loadTestDetails();
