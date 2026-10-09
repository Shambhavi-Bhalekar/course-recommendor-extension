# Course Copilot for Counsellors

Course Copilot is a Chrome Extension built to assist education counsellors during live student counselling sessions, including sessions conducted through Google Meet.

It helps counsellors capture student requirements, recommend suitable courses, compare shortlisted options, estimate costs, check deadlines, identify scholarship opportunities, explore post-study work options and careers, and ask AI-powered questions grounded in the available course data.

Demo Link : https://drive.google.com/file/d/1d6-YU-5Ikcouhf2c4YoBt4ooG3BzxqQl/view?usp=sharing

---

## Features

### 1. Student Profile

Create a student profile using:

- Student name
- Study level
- Preferred field
- Academic percentage
- IELTS score
- Budget
- Preferred intake
- Preferred countries
- Excluded countries

The profile is used to calculate course-fit recommendations.


### 2. Quick Capture

Quick Capture allows counsellors to quickly record information mentioned by a student during a counselling conversation.

Captured information can be reviewed and undone when required.

### 3. Course Recommendations

Course Copilot evaluates the student profile against the course dataset and provides recommendations based on:

- Academic eligibility
- IELTS eligibility
- Field match
- Budget fit
- Country preference
- Intake compatibility
- Course level
- Overall match

### 4. Ask Next

Ask Next suggests useful follow-up questions based on the student's profile and missing information.

This helps counsellors continue the conversation and identify important requirements.

### 5. Course Verification

Course information can include:

- Source URL
- Last verified date
- Verification status

This helps distinguish verified information from information that still requires verification.

### 6. Shortlist

Counsellors can pin courses to create a shortlist.

Shortlisted courses can be used for:

- Course comparison
- Cost estimation
- Scholarship matching
- Career analysis
- Post-study analysis
- Sharing

### 7. Compare Courses

Compare 2–3 pinned courses using:

- Tuition fees
- Intake
- Requirements
- Duration
- Student gaps
- Relative value

### 8. Total Cost Estimator

Estimate the overall cost of studying a course using:

- Tuition
- Estimated living costs
- Insurance
- Visa costs
- Study duration
- Estimated yearly cost
- Estimated total cost

The estimator also helps identify lower-cost alternatives.

### 9. Deadline & Intake Countdown

The extension displays application deadline information such as:

- Application deadline
- Days remaining
- Next intake
- Urgency indicators

### 10. Scholarship Matcher

The scholarship matcher compares scholarship eligibility signals with the student's profile.

Where a scholarship amount is known, it can display:

- Scholarship amount
- Adjusted tuition
- Estimated savings

Where an award amount is not verified, the extension indicates that the amount needs to be verified instead of inventing a value.

### 11. Post-Study Work & Career Outlook

For supported courses, the extension provides:

- Typical career roles
- Post-study work information
- Stay-back information
- Relevant work-route information
- Source information
- Verification status

### 12. Grounded AI Q&A

Course Copilot includes an AI-powered Q&A workflow.

Questions are answered using retrieved course information supplied to the backend.

The backend returns:

- AI answer
- Grounded status
- Course citations
- Verification information
- Retrieved course count

The LLM API key remains on the backend and is not exposed inside the Chrome extension.

---

# Installation

## Requirements

- Google Chrome
- Git
- The Course Copilot repository
- Access to the deployed backend

---

## 1. Clone the Repository

```bash
git clone https://github.com/Shambhavi-Bhalekar/course-recommendor-extension.git
```

## 2. Add the Extension to Chrome

After cloning the repository, open Google Chrome and go to:

```text
chrome://extensions
```

Enable **Developer mode** using the toggle in the top-right corner.

Then click:

```text
Load unpacked
```

Navigate to the cloned project folder:

```text
course-recommendor-extension/
```

Select the **root folder of the project**, which contains:

```text
course-recommendor-extension/
│
├── manifest.json
├── sidepanel.html
├── sidepanel.js
├── background.js
├── courses.js
├── courseData.js
├── llmClient.js
├── llmQuery.js
├── profileStore.js
├── quickCapture.js
├── askNext.js
├── coursePlanning.js
├── shortlistFeatures.js
├── export.js
├── qa.js
│
└── backend/
    ├── server.js
    ├── package.json
    └── package-lock.json
```

> **Important:** Select the `course-recommendor-extension` folder, **not** the `backend` folder.

Chrome will then add **Course Copilot for Counsellors** to the extensions list.


## 3. Open Course Copilot

After the extension is loaded:

1. Open Chrome.
2. Click the **Extensions** icon.
3. Find **Course Copilot for Counsellors**.
4. Open the extension.
5. Open the Course Copilot side panel.

The extension can now be used alongside Google Meet during counselling sessions.
