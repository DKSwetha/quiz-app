
// ========================================
// 1. Get the logged-in member
// ========================================

const user = requireRole("member", "login.html");

// Stop execution if the user is not a member
if (!user) {
    throw new Error("Member login required");
}


// ========================================
// 2. Display member information
// ========================================

document.getElementById("userName").textContent = user.name;
document.getElementById("welcomeName").textContent = user.name;


// ========================================
// 3. Logout functionality
// ========================================

document.getElementById("logoutBtn").addEventListener("click", function () {
    logout("login.html");
});


// ========================================
// 4. Load dashboard data
// ========================================

async function loadDashboard() {

    try {

        // Fetch dashboard information from FastAPI
        const data = await apiGet(
            `/members/${user.user_id}/dashboard`
        );

        // Display assigned tests
        displayAssignedTests(data.assigned_tests || []);

        // Display recent results
        displayRecentResults(data.recent_results || []);

        // Update statistics
        updateStatistics(data.assigned_tests || []);

    } catch (error) {

        console.error("Dashboard loading error:", error);

        document.getElementById("assignedTests").innerHTML = `
            <div class="col-12">
                <p class="text-danger">
                    Unable to load assigned tests.
                </p>
            </div>
        `;

        document.getElementById("recentResults").textContent =
            "Unable to load recent results.";

        showAlert("dashboardAlert", error.message, "danger");
    }
}


// ========================================
// 5. Update dashboard statistics
// ========================================

function updateStatistics(tests) {

    const total = tests.length;

    const completed = tests.filter(function (test) {
        return test.status === "submitted";
    }).length;

    const pending = tests.filter(function (test) {
        return test.status === "assigned" ||
               test.status === "in_progress";
    }).length;

    document.getElementById("totalAssigned").textContent = total;

    document.getElementById("completedTests").textContent = completed;

    document.getElementById("pendingTests").textContent = pending;
}


// ========================================
// 6. Display assigned tests
// ========================================

function displayAssignedTests(tests) {

    const container = document.getElementById("assignedTests");

    container.replaceChildren();

    if (tests.length === 0) {

        container.innerHTML = `
            <div class="col-12">
                <div class="empty-state">
                    <h6>No tests assigned yet</h6>
                    <p class="mb-0">
                        Your assigned tests will appear here.
                    </p>
                </div>
            </div>
        `;

        return;
    }

    tests.forEach(function (test) {

        const column = document.createElement("div");
        column.className = "col-md-6 col-lg-4";

        const card = document.createElement("div");
        card.className = "card test-card";

        const body = document.createElement("div");
        body.className = "card-body";

        const title = document.createElement("h6");
        title.className = "card-title";
        title.textContent = test.title;

        const duration = document.createElement("p");
        duration.className = "test-details mb-2";
        duration.textContent =
            `Duration: ${test.duration_minutes} minutes`;

        const marks = document.createElement("p");
        marks.className = "test-details mb-3";
        marks.textContent = `Total marks: ${test.total_marks}`;

        const status = document.createElement("span");
        status.className = `test-status status-${test.status}`;
        status.textContent = test.status.replace("_", " ");

        body.append(title, duration, marks, status);
        card.appendChild(body);
        column.appendChild(card);
        container.appendChild(column);

    });
}


// ========================================
// 7. Display recent results
// ========================================

function displayRecentResults(results) {

    const container = document.getElementById("recentResults");

    container.replaceChildren();

    if (results.length === 0) {

        const emptyMessage = document.createElement("p");
        emptyMessage.className = "empty-state mb-0";
        emptyMessage.textContent = "No results available yet.";

        container.appendChild(emptyMessage);

        return;
    }

    results.forEach(function (result) {

        const item = document.createElement("div");
        item.className = "result-item";

        const details = document.createElement("div");

        const title = document.createElement("p");
        title.className = "result-title";
        title.textContent = result.title;

        const date = document.createElement("p");
        date.className = "result-details mb-0";
        date.textContent =
            `Submitted: ${formatDate(result.submitted_at)}`;

        details.append(title, date);

        const score = document.createElement("strong");
        score.textContent =
            `${result.score} / ${result.total_marks}`;

        item.append(details, score);
        container.appendChild(item);

    });
}


// ========================================
// 8. Format date
// ========================================

function formatDate(dateValue) {

    if (!dateValue) {
        return "Not available";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "Not available";
    }

    return date.toLocaleDateString();
}


// ========================================
// 9. Start dashboard
// ========================================

loadDashboard();
