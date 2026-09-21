# EDUCATION FORUM

## COMPLETE DEVELOPER UPDATE & FEATURE SPECIFICATION

**App Name:** Education Forum

**Purpose:**
This document contains the complete list of updates and new features required for Education Forum. The application should be built as an education-first platform with controlled social features, flexible monetization, strong admin control, user-generated educational content, student support systems, and international payments.

---

# 1. EDUCATION LIBRARY 📚

Add a dedicated **Education Library** where users can upload educational books and learning materials.

## 1.1 Book Upload

Users should be able to:

* Upload educational books/materials.
* Add book title.
* Add description.
* Select subject/category.
* Add author/uploader information.
* Upload cover image.
* Upload the book file.
* Submit the book for review.

## 1.2 Mandatory Admin Approval

Uploaded books must **NOT become publicly available immediately**.

The required workflow is:

**User Uploads → Pending Review → Admin Reviews → Approved / Rejected → Approved Book Goes Live**

The admin dashboard should allow admins to:

* View pending books.
* Open/preview submitted books.
* See uploader information.
* See upload date.
* Approve books.
* Reject books.
* Request changes where necessary.
* Remove previously approved books if necessary.
* See the complete approval history.

Only books that have been approved by an authorized admin can become publicly available.

---

# 2. EDUCATION LIBRARY DISCOVERY

The library should include:

* Search.
* Categories.
* Subjects.
* Education levels.
* Popular books.
* New books.
* Recommended books.
* Most-viewed books.
* Author/teacher discovery where applicable.

The library should be designed primarily for **education and reading**, rather than social media.

---

# 3. COLOUR BRANDING 🎨

The developer/design team should create a professional **Education Forum colour and visual branding system**.

The branding should communicate:

* Education.
* Trust.
* Intelligence.
* Modern technology.
* Student friendliness.
* Professionalism.

The designer/developer should determine the most suitable:

* Primary colour.
* Secondary colour.
* Accent colour.
* Background colours.
* Text colours.
* Button colours.
* Card colours.
* Navigation colours.
* Light/dark interface treatment if appropriate.

The chosen branding should be consistent throughout:

* Home screen.
* Education Library.
* Reading interface.
* Profiles.
* Teacher/tutor areas.
* Subscription pages.
* Payment screens.
* Helping Hands.
* Supporting Hands.
* Reels.
* Admin dashboard.

Do not use random colours for individual sections. The entire application should have one recognizable Education Forum identity.

---

# 4. PAID SUBSCRIPTIONS 💳

Education Forum should support **paid subscriptions**.

The subscription system must be flexible and controlled through the admin dashboard.

Admins should be able to:

* Create subscription plans.
* Edit subscription plans.
* Set prices.
* Change prices.
* Activate/deactivate plans.
* Decide which features are included.
* Decide which content requires a subscription.
* Create different subscription levels if required.
* Change subscription benefits in the future.

The subscription architecture should not require a new app release every time the owner wants to change a subscription.

---

# 5. PREMIER FEATURES ⭐

Add a **Premier** feature system.

Premier features should be configurable by the admin.

The admin should be able to decide:

* Which features are free.
* Which features are Premier.
* Which features are included in subscriptions.
* Which features require an individual payment.
* Which features are temporarily free.
* Which features should be removed from Premier.

Do **not** permanently hard-code the monetization model.

The owner will decide after seeing the prototype which features should be:

**Free / Paid Individually / Premier / Subscription-only**

The system must support these decisions from the admin dashboard.

---

# 6. STUDENT AND TUTOR EARNINGS 💰

Education Forum should have a creator/educator earnings system.

Eligible students, tutors and educational creators should potentially be able to earn from their content.

Earnings may be based on:

* Number of views.
* Number of subscribers.
* Engagement where appropriate.
* Other metrics that can be introduced later.

The exact formula must remain configurable.

## 6.1 Earnings Flow

The system should support:

**Views/Subscribers → Calculated Earnings → Pending Earnings → Approved Earnings → Withdrawable Balance → Payout**

The user should be able to see their earnings and transaction history.

---

# 7. ADMIN CONTROL OVER EARNINGS 🎛️

The admin dashboard must control the earnings system.

Admins should be able to:

* Set earnings rates.
* Set earnings per view.
* Set earnings per subscriber.
* Decide who qualifies for monetization.
* Enable/disable monetization for individual users.
* Set minimum payout thresholds.
* Set maximum/minimum earning limits if required.
* Review earnings.
* Approve earnings where necessary.
* Adjust earnings when legitimately required.
* Suspend monetization.
* View payout history.
* View creator earnings history.

The earning formula should **NOT be permanently hard-coded**.

---

# 8. TEACHER EARNINGS 👨‍🏫

Teachers should have their own earnings system.

Teacher earnings can be based on:

* Subscribers.
* Views.
* Or a combination of both.

The developer should create the system so that the admin can determine the formula.

For example, the platform could support:

**Teacher Earnings = View Earnings + Subscriber Earnings**

The actual rates must be controlled by the admin.

This allows Education Forum to change its monetization strategy without rebuilding the application.

---

# 9. LANGUAGE LEARNING 🌍

Add a dedicated **Language Learning** section.

Initial languages:

* 🇫🇷 French
* 🇳🇱 Dutch
* 🇪🇸 Spanish

The architecture should allow additional languages to be added later.

Each language can contain:

* Beginner lessons.
* Intermediate lessons.
* Advanced lessons.
* Vocabulary.
* Grammar.
* Reading exercises.
* Listening exercises where supported.
* Quizzes.
* Progress tracking.
* Learning levels.

The admin should be able to add/manage languages and learning content in the future.

---

# 10. PAYMENT SYSTEM 💳🌍

Education Forum must support payments for users in:

* 🇳🇬 Nigeria.
* 🇿🇦 South Africa.
* 🇬🇧 United Kingdom.
* 🇺🇸 United States.

The system should integrate suitable payment solutions supporting the required markets.

Requested payment methods include:

* **EcoCash**
* **Swift / international bank transfer**
* **PayPal**
* **OPay**

The developer should select the most suitable and reliable payment-provider architecture for these countries rather than forcing an unsuitable provider.

The payment architecture must be expandable so additional providers can be added later.

---

# 11. CENTRAL PAYMENT SYSTEM

Create a centralized payment architecture capable of handling:

* Subscription payments.
* Premier purchases.
* Paid educational content where applicable.
* Student/tutor earnings.
* Creator payouts.
* Donations.
* Student funding.
* Refunds where applicable.
* Payment failures.
* Transaction records.

Every transaction should have an appropriate status, such as:

**Pending → Successful / Failed → Refunded where applicable**

Users should be able to see their own transaction history.

Admins should be able to see platform-wide transaction records.

---

# 12. HELPING HANDS 🤝

Create a section called **Helping Hands**.

Purpose:

Allow people to donate money to help students who require financial assistance.

---

# 13. HELPING HANDS — STUDENT APPLICATIONS

Students should be able to:

* Apply for assistance.
* Explain what assistance they need.
* Provide relevant information.
* Upload supporting documentation where appropriate.
* Submit their application.

## VERY IMPORTANT — ADMIN REVIEW REQUIRED

Student assistance applications must **NOT go live immediately after submission**.

The mandatory workflow is:

**Student Applies → Pending Review → Admin Reviews → Approved / Rejected → Approved Application Goes Live**

Only applications approved by an authorized admin can become publicly visible.

The system must never automatically publish a student's assistance request.

---

# 14. HELPING HANDS — ADMIN CONTROL

Admins should be able to:

* View pending applications.
* Review applications.
* Review supporting information.
* Approve applications.
* Reject applications.
* Request additional information.
* Set funding targets.
* Track donations.
* Track funds distributed.
* Manage active assistance cases.
* Close completed cases.
* Suspend suspicious or fraudulent applications.
* Maintain an administrative history of decisions.

Student privacy must be protected.

Only the information approved for public display should be visible to donors or other users.

---

# 15. HELPING HANDS — DONATIONS

Users should be able to:

* View approved assistance cases.
* Choose an approved student/cause to support where appropriate.
* Donate money.
* Receive payment confirmation.
* View their donation history.

Donations should be connected to the centralized payment system.

---

# 16. SUPPORTING HANDS 💡🤝

Create a separate section called **Supporting Hands**.

Purpose:

Allow students to submit ideas, projects or initiatives that may qualify for financial support.

---

# 17. SUPPORTING HANDS — STUDENT IDEA SUBMISSION

Students should be able to:

1. Submit an idea.
2. Give the idea a title.
3. Explain the idea.
4. Explain the purpose.
5. Explain what funding is required for.
6. Provide supporting information/documents where appropriate.
7. Submit the idea.

## ADMIN REVIEW REQUIRED

Ideas must **NOT become publicly visible immediately**.

The required workflow is:

**Student Submits Idea → Pending Review → Admin Reviews → Approved / Rejected → Approved Idea Goes Live**

Only approved ideas should become visible to other users.

---

# 18. SUPPORTING HANDS — ADMIN NEGOTIATION

Admins should be able to:

* Review submitted ideas.
* Contact/discuss the idea with the student.
* Request additional information.
* Negotiate the proposed funding amount.
* Agree on funding conditions.
* Approve or reject the proposal.
* Record the agreed funding amount.
* Release funding according to the approved process.
* Track project progress.
* Mark projects as completed.

The system should maintain a clear record:

**Idea Submitted → Review → Negotiation → Agreement → Funding → Progress → Completion**

Large or significant funding should not be automatically released.

Funding should remain under appropriate admin control.

---

# 19. STUDENT REELS 🎥

Add a small **Reels** section specifically for students.

The purpose is to provide a limited social element without turning Education Forum into a social-media application.

Students should be able to:

* Upload short videos.
* Watch student videos.
* Like/react.
* Comment where appropriate.
* Report inappropriate content.
* Follow other students/creators if included in the final design.

---

# 20. REELS MUST REMAIN A SMALL FEATURE ⚠️

The Reels section should **not dominate the application**.

Education Forum is primarily:

**📚 Education + 🎓 Learning + 📖 Reading + 👨‍🏫 Teachers/Tutors + 💡 Student Opportunities**

Reels should be secondary.

Do not design the application around an endless TikTok-style experience.

Reels should:

* Have a dedicated section.
* Have limited prominence on the main interface.
* Not dominate the home screen.
* Not interfere with reading.
* Not interfere with courses.
* Not interfere with language learning.
* Not become the main reason users remain in the app.

The product should encourage users to return to learning.

---

# 21. CONTENT MODERATION 🛡️

Because users can submit books, videos, assistance requests and ideas, strong moderation tools are required.

Moderation should cover:

* Books.
* Reels.
* Comments.
* Teacher content.
* Tutor content.
* Student applications.
* Funding requests.
* Student ideas.
* User reports.

Users should have a reporting mechanism.

Admins should be able to:

* Review reports.
* Remove content.
* Warn users.
* Suspend accounts.
* Ban accounts where necessary.
* Review moderation history.

---

# 22. ADMIN DASHBOARD 🎛️

The admin dashboard should be the central control centre for Education Forum.

## Content Management

Admins should manage:

* Books.
* Library categories.
* Teachers.
* Tutors.
* Students.
* Courses.
* Language learning.
* Reels.
* Educational content.

## Monetization

Admins should manage:

* Subscription plans.
* Subscription prices.
* Premier features.
* Paid features.
* Creator earnings.
* Teacher earnings.
* View rates.
* Subscriber rates.
* Payout thresholds.

## Payments

Admins should manage:

* Transactions.
* Subscription payments.
* Donations.
* Funding.
* Withdrawals.
* Creator payouts.
* Payment status.
* Refunds where applicable.

## Users

Admins should manage:

* User accounts.
* User roles.
* Verification.
* Suspensions.
* Reports.
* Monetization eligibility.

## Helping Hands

Admins should manage:

* Assistance applications.
* Pending applications.
* Approved applications.
* Rejected applications.
* Donations.
* Funding distribution.

## Supporting Hands

Admins should manage:

* Student ideas.
* Pending ideas.
* Approved ideas.
* Rejected ideas.
* Negotiations.
* Funding agreements.
* Project progress.

---

# 23. UNIVERSAL APPROVAL SYSTEM 🔐

Any user-generated content that could become publicly visible should be designed around moderation and approval where appropriate.

At minimum, the following must have a **Pending Review** status before becoming public:

### Education Library

**Upload → Pending Review → Admin Approval → Live**

### Helping Hands

**Application → Pending Review → Admin Approval → Live**

### Supporting Hands

**Idea → Pending Review → Admin Approval → Live**

### Other User Content

Where necessary, use appropriate moderation/review mechanisms before public publication.

The developer should ensure there is no accidental automatic publishing of sensitive submissions.

---

# 24. FLEXIBLE SYSTEM DESIGN ⚙️

A major requirement is that Education Forum must be flexible.

Avoid hard-coding business rules that may change.

Where practical, the admin should be able to control:

* Subscription prices.
* Subscription plans.
* Premier features.
* Paid features.
* Free features.
* Earnings rates.
* View rates.
* Subscriber rates.
* Payout thresholds.
* Languages.
* Library categories.
* Funding limits.
* Payment providers.
* User permissions.
* Monetization eligibility.

The owner should be able to change the business model without requiring the developer to rebuild the entire application.

---

# 25. SECURITY AND FINANCIAL CONTROLS 🔒

Because Education Forum will involve payments, donations and creator earnings, financial functions should be handled securely.

The system should include:

* Secure payment processing.
* Transaction records.
* Proper authorization.
* Admin permissions.
* Role-based access.
* Protection against unauthorized balance changes.
* Audit logs for important financial/admin actions.
* Clear payment status.
* Protection against duplicate transactions.
* Appropriate verification for sensitive actions.

Admins should not be able to accidentally or casually alter financial records without an appropriate audit trail.

---

# 26. USER ROLES

The architecture should support different roles, including:

* Student.
* Teacher.
* Tutor.
* Educational creator.
* Admin.
* Super Admin/Owner where appropriate.

Each role should have appropriate permissions.

A student should not automatically receive teacher, tutor or administrative privileges.

---

# 27. ADVERTISING 📢

**Advertising specifications will be provided later.**

For the prototype stage:

* Do not finalize advertising placements.
* Do not permanently design the advertising system around assumptions.
* Keep the architecture ready for future advertising integration.
* Advertising must not interfere with reading or learning.

Final advertising formats, placements, frequency and rules will be provided after the prototype is reviewed.

---

# 28. DEVELOPMENT PRIORITY 🚀

Build the updates in a logical order.

## PHASE 1 — CORE PLATFORM

* Education Forum branding.
* User accounts.
* Roles and permissions.
* Admin dashboard.
* Education Library.
* Book upload.
* Book approval/rejection system.
* Search and categories.

## PHASE 2 — LEARNING

* Teacher system.
* Tutor system.
* Language Learning.
* French.
* Dutch.
* Spanish.
* Student learning features.
* Educational content discovery.

## PHASE 3 — MONETIZATION

* Paid subscriptions.
* Premier system.
* Central payment system.
* Payment provider integrations.
* Creator earnings.
* Teacher earnings.
* Student/tutor earnings.
* Payout system.

## PHASE 4 — STUDENT SUPPORT

* Helping Hands.
* Assistance applications.
* Admin review system.
* Donations.
* Supporting Hands.
* Student idea submissions.
* Admin negotiation.
* Funding system.
* Project tracking.

## PHASE 5 — LIMITED SOCIAL

* Student Reels.
* Likes/reactions.
* Comments.
* Reporting.
* Moderation.
* Controls to prevent Reels from dominating the application.

## PHASE 6 — ADVERTISING

Advertising should be implemented after the prototype has been reviewed.

The final advertising specification will be provided separately.

---

# 29. OVERALL PRODUCT DIRECTION 🎓

Education Forum must feel like an **education platform first**.

The core experience should revolve around:

**📚 Education Library**
**🎓 Learning**
**👨‍🏫 Teachers & Tutors**
**🌍 Language Learning**
**💳 Paid Subscriptions**
**⭐ Premier Features**
**💰 Creator/Teacher Earnings**
**🤝 Helping Hands**
**💡 Supporting Hands**
**🎥 Limited Student Reels**

The social component must remain secondary.

The application should prioritize:

**Learning → Reading → Education → Opportunities → Student Support**

rather than:

**Scrolling → Entertainment → Social Media**

---

# 30. FINAL DEVELOPER REQUIREMENT

The developer should integrate the most suitable technical solution for the intended functionality.

Where a better technical solution exists than the exact implementation described in this document, use the better solution **provided that it preserves the intended business functionality**.

The application should be built to be:

* Scalable.
* Secure.
* Mobile-friendly.
* Fast.
* Easy to manage.
* Flexible.
* Admin-controlled.
* Suitable for international payments.
* Ready for future monetization changes.
* Ready for additional languages.
* Ready for additional payment providers.
* Ready for additional educational features.

Most importantly, **admin control should be built into the architecture from the beginning**, particularly for content approval, monetization, subscriptions, earnings, payments, donations and student funding.

**Education Forum should launch as an education-first platform, with the flexibility to evolve its business model after the prototype is tested.**
