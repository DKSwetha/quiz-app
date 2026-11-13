
const user = requireRole("member", "../html/login.html");

if (!user) {
    throw new Error("Member login required");
}


// Display member information
document.getElementById("userName").textContent = user.name;
document.getElementById("welcomeName").textContent = user.name;


// Logout
document.getElementById("logoutBtn").addEventListener("click", function () {
    logout("../html/login.html");
});


// Load dashboard data
async function loadDashboard() {

    try {

        const data = await apiGet(
            `/members/${user.user_id}/dashboard`
        );

        displayAssignedTests(data.assigned_tests || []);
        displayRecentResults(data.recent_results || []);
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


// Update statistics
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


// Display assigned tests
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

        // View Details button
        const viewButton = document.createElement("a");
        viewButton.className = "btn btn-primary w-100 mt-3";
        viewButton.textContent = "View Details";
        viewButton.href =
            `../html/test_details.html?test_id=${encodeURIComponent(test.test_id)}`;

        body.append(title, duration, marks, status, viewButton);
        card.appendChild(body);
        column.appendChild(card);
        container.appendChild(column);

    });
}


// Display recent results
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


// Format date
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


loadDashboard();
