
// Check the logged-in member
const user = requireRole("member", "../html/login.html");

if (!user) {
    throw new Error("Member login required");
}

// Read test and attempt IDs from the URL
const params = new URLSearchParams(window.location.search);
const testId = params.get("test_id");
const attemptId = params.get("attempt_id");

// Store exam information
let questions = [];
let currentIndex = 0;
let endsAt = null;
let timerInterval = null;
let isSubmitting = false;
let isSubmitted = false;

// Keep answer saves in order for each question
const saveQueues = new Map();

// Get page elements
const examContent = document.getElementById("examContent");
const testTitle = document.getElementById("testTitle");
const timer = document.getElementById("timer");
const timerBox = document.querySelector(".timer-box");
const questionNumber = document.getElementById("questionNumber");
const questionMarks = document.getElementById("questionMarks");
const questionText = document.getElementById("questionText");
const optionsContainer = document.getElementById("optionsContainer");
const questionPalette = document.getElementById("questionPalette");
const previousBtn = document.getElementById("previousBtn");
const nextBtn = document.getElementById("nextBtn");
const markReviewBtn = document.getElementById("markReviewBtn");
const submitTestBtn = document.getElementById("submitTestBtn");
const confirmSubmitBtn = document.getElementById("confirmSubmitBtn");
const saveStatus = document.getElementById("saveStatus");


// Validate the URL parameters
function validId(value) {
    return value && Number.isInteger(Number(value)) && Number(value) > 0;
}


// Show an error message
function showExamError(message) {
    showAlert("examAlert", message, "danger");
}


// Load questions for this attempt
async function loadAttempt() {
    if (!validId(testId) || !validId(attemptId)) {
        showExamError("Invalid test or attempt ID.");
        return;
    }

    try {
        // Get questions and saved answers from the backend
        const data = await apiGet(
            `/members/${user.user_id}/attempts/${attemptId}/questions`
        );

        if (!Array.isArray(data.questions) || data.questions.length === 0) {
            showExamError("No questions are available for this test.");
            return;
        }

        questions = data.questions.map(function (question) {
            return {
                ...question,
                question_id: question.question_id ?? question.id,
                selected_option: question.selected_option || null,
                marked_for_review: Boolean(question.marked_for_review)
            };
        });

        endsAt = new Date(data.ends_at);
        console.log("Backend deadline:", data.ends_at);
        console.log("Parsed deadline:", endsAt);
        console.log("Current time:", new Date());

        if (Number.isNaN(endsAt.getTime())) {
            showExamError("The server returned an invalid test deadline.");
            return;
        }

        testTitle.textContent = data.test_title || "Quiz Test";

        examContent.classList.remove("d-none");

        renderQuestion();
        renderPalette();
        updateSummary();
        startTimer();

    } catch (error) {
        console.error("Loading attempt error:", error);
        showExamError(error.message || "Unable to load the test.");
    }
}


// Display the current question
function renderQuestion() {
    const question = questions[currentIndex];

    if (!question) {
        return;
    }

    question.visited = true;

    questionNumber.textContent =
        `Question ${currentIndex + 1} of ${questions.length}`;

    questionMarks.textContent =
        `${question.marks ?? 1} Mark${Number(question.marks ?? 1) === 1 ? "" : "s"}`;

    questionText.textContent = question.text;

    optionsContainer.replaceChildren();

    const options = Array.isArray(question.options)
    ? question.options
    : [
        { letter: "A", text: question.option_a },
        { letter: "B", text: question.option_b },
        { letter: "C", text: question.option_c },
        { letter: "D", text: question.option_d }
    ];

    options.forEach(function (option) {
        const label = document.createElement("label");
        label.className = "option-item";

        if (question.selected_option === option.letter) {
            label.classList.add("selected");
        }

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = `question-${question.question_id}`;
        radio.value = option.letter;
        radio.checked = question.selected_option === option.letter;

        radio.addEventListener("change", function () {
            selectAnswer(option.letter);
        });

        const letter = document.createElement("span");
        letter.className = "option-letter";
        letter.textContent = option.letter;

        const text = document.createElement("span");
        text.className = "option-text";
        text.textContent = option.text;

        label.append(radio, letter, text);
        optionsContainer.appendChild(label);
    });

    previousBtn.disabled = currentIndex === 0;

    nextBtn.textContent =
        currentIndex === questions.length - 1 ? "Last Question" : "Next";

    markReviewBtn.textContent = question.marked_for_review
        ? "Remove Review"
        : "Mark for Review";

    renderPalette();
}


// Save an answer to the backend
async function saveAnswer(question) {
    const questionId = question.question_id;

    saveStatus.textContent = "Saving...";
    saveStatus.className = "save-status";

    const previousSave = saveQueues.get(questionId) || Promise.resolve();

    const currentSave = previousSave
        .catch(function () {
            // Continue with the latest answer even if an earlier save failed
        })
        .then(function () {
            return apiPut(
                `/members/${user.user_id}/attempts/${attemptId}/answers/${questionId}`,
                {
                    selected_option: question.selected_option,
                    marked_for_review: question.marked_for_review
                }
            );
        });

    saveQueues.set(questionId, currentSave);

    try {
        await currentSave;

        saveStatus.textContent = "Answer saved";
        saveStatus.className = "save-status saved";

    } catch (error) {
        console.error("Answer save error:", error);

        saveStatus.textContent = "Unable to save answer";
        saveStatus.className = "save-status error";

        showExamError(
            "Your latest answer could not be saved. Please check your connection and try again."
        );

        throw error;

    } finally {
        if (saveQueues.get(questionId) === currentSave) {
            saveQueues.delete(questionId);
        }
    }
}


// Select an answer
async function selectAnswer(option) {
    const question = questions[currentIndex];

    question.selected_option = option;

    renderQuestion();
    renderPalette();
    updateSummary();

    try {
        await saveAnswer(question);
    } catch (error) {
        // The error is displayed by saveAnswer
    }
}


// Move to the previous question
previousBtn.addEventListener("click", function () {
    if (currentIndex > 0) {
        currentIndex--;
        renderQuestion();
        renderPalette();
    }
});


// Move to the next question
nextBtn.addEventListener("click", function () {
    if (currentIndex < questions.length - 1) {
        currentIndex++;
        renderQuestion();
        renderPalette();
    }
});


// Mark or remove a question for review
markReviewBtn.addEventListener("click", async function () {
    const question = questions[currentIndex];

    question.marked_for_review = !question.marked_for_review;

    renderQuestion();
    renderPalette();
    updateSummary();

    try {
        await saveAnswer(question);
    } catch (error) {
        // The error is displayed by saveAnswer
    }
});


// Create the question navigation palette

function renderPalette() {
    questionPalette.replaceChildren();

    questions.forEach(function (question, index) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "palette-button";
        button.textContent = index + 1;

        button.setAttribute(
            "aria-label",
            `Go to question ${index + 1}`
        );

        // Apply exactly one question status
        if (question.marked_for_review) {
            button.classList.add("review");
        } else if (question.selected_option) {
            button.classList.add("answered");
        } else if (question.visited) {
            button.classList.add("unanswered");
        } else {
            button.classList.add("not-visited");
        }

        // Highlight the currently displayed question
        if (index === currentIndex) {
            button.classList.add("current");
            button.setAttribute("aria-current", "step");
        }

        button.addEventListener("click", function () {
            currentIndex = index;
            renderQuestion();
            renderPalette();
            updateSummary();
        });

        questionPalette.appendChild(button);
    });
}


// Update the answer summary
function updateSummary() {
    const answered = questions.filter(function (question) {
        return Boolean(question.selected_option);
    }).length;

    const review = questions.filter(function (question) {
        return question.marked_for_review;
    }).length;

    document.getElementById("answeredCount").textContent = answered;

    document.getElementById("unansweredCount").textContent =
        questions.length - answered;

    document.getElementById("reviewCount").textContent = review;
}


// Start the countdown using the server deadline
function startTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    updateTimer();

    timerInterval = setInterval(updateTimer, 1000);
}


// Update the countdown
function updateTimer() {
    const remaining = Math.max(0, endsAt.getTime() - Date.now());

    const totalSeconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    timer.textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    timerBox.classList.remove("timer-warning", "timer-danger");

    if (totalSeconds <= 60) {
        timerBox.classList.add("timer-danger");
    } else if (totalSeconds <= 300) {
        timerBox.classList.add("timer-warning");
    }

    if (remaining <= 0) {
        clearInterval(timerInterval);
        submitAttempt(true);
    }
}


// Open the submission confirmation
submitTestBtn.addEventListener("click", function () {
    const modalElement = document.getElementById("submitModal");
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);

    modal.show();
});


// Confirm submission
confirmSubmitBtn.addEventListener("click", async function () {
    const modalElement = document.getElementById("submitModal");
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);

    modal.hide();

    await submitAttempt(false);
});


// Submit the test
async function submitAttempt(autoSubmit) {
    if (isSubmitting || isSubmitted) {
        return;
    }

    isSubmitting = true;
    submitTestBtn.disabled = true;
    confirmSubmitBtn.disabled = true;

    if (timerInterval) {
        clearInterval(timerInterval);
    }

    try {
        // Wait for pending answer saves
        await Promise.all([...saveQueues.values()]);

        // Submit the attempt to the backend
        const result = await apiPost(
            `/members/${user.user_id}/attempts/${attemptId}/submit`,
            {}
        );

        isSubmitted = true;

        document.getElementById("examContent").classList.add("d-none");

        const completion = document.getElementById("completionMessage");
        completion.classList.remove("d-none");

        const heading = document.createElement("h2");
        heading.textContent = "Test Submitted Successfully";

        const message = document.createElement("p");
        message.textContent = autoSubmit
            ? "Your test was submitted automatically because the time ended."
            : "Your answers have been submitted successfully.";

        const dashboardLink = document.createElement("a");
        dashboardLink.href = "../html/dashboard.html";
        dashboardLink.className = "btn btn-brand mt-3";
        dashboardLink.textContent = "Back to Dashboard";

        completion.replaceChildren(heading, message, dashboardLink);

    } catch (error) {
        console.error("Test submission error:", error);

        isSubmitting = false;
        submitTestBtn.disabled = false;
        confirmSubmitBtn.disabled = false;

        showExamError(
            error.message || "Unable to submit the test. Please try again."
        );

        if (endsAt.getTime() > Date.now()) {
            startTimer();
        }
    }
}


// Warn before leaving an active test
window.addEventListener("beforeunload", function (event) {
    if (!isSubmitted && questions.length > 0) {
        event.preventDefault();
        event.returnValue = "";
    }
});


// Load the exam

async function loadAttempt() {
    if (!validId(testId) || !validId(attemptId)) {
        showExamError("Invalid test or attempt ID.");
        return;
    }

    try {
        // Request questions for this member's attempt
        const data = await apiGet(
            `/members/${user.user_id}/attempts/${attemptId}/questions`
        );

        if (!Array.isArray(data.questions) || data.questions.length === 0) {
            showExamError("No questions are available for this test.");
            return;
        }

        // Store questions and existing answers
        questions = data.questions.map(function (question) {
    return {
        ...question,
        question_id: question.question_id ?? question.id,
        selected_option: question.selected_option || null,
        marked_for_review: Boolean(question.marked_for_review),
        visited: false
    };
});
        // Use the deadline supplied by the backend
        endsAt = new Date(data.ends_at);

        if (Number.isNaN(endsAt.getTime())) {
            showExamError("Invalid test deadline received from server.");
            return;
        }

        testTitle.textContent = data.test_title || "Quiz Test";

        // Show the exam interface
        examContent.classList.remove("d-none");

        renderQuestion();
        renderPalette();
        updateSummary();
        startTimer();

    } catch (error) {
        console.error("Loading attempt error:", error);

        showExamError(
            error.message || "Unable to load test questions."
        );
    }
}

loadAttempt();
