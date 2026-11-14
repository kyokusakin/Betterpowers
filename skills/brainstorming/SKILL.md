---
name: brainstorming
description: Use before building something new when the request leaves open what it is for, what it does, or how it looks, and the project does not settle it, such as "make a button" on a page with no buttons. Not for bug reports, issues that state the expected behavior, or requests the project already settles.
argument-hint: "[idea or request]"
---

Find out what the user wants, and why, before anything is built. The Asking rules apply throughout.

1. Look first. Read what the user pointed at and the code it touches until you can say how the relevant parts work today and what the change would touch. If that settles everything, build it, state your choices, and stop using this skill.
2. Your first message holds what you found that bears on the request and the one open question whose answer changes the most, with what it would change. If they have not said why they want it, ask that openly, without options. Unless they asked for a discussion, end with a one-line offer to start now on defaults you name. Build nothing before they answer.
3. A small request is settled by that answer: build it and state the defaults you chose. A feature or product needs the steps below.
4. Ask one question at a time, each built on the last answer or on something you found. Play each settled part back and ask what is wrong or missing. Mark what you filled in as your proposal, never as theirs.
5. When what they want is clear, lay out two or three ways to build it in a message of its own. Ground each in this codebase, with what it trades off and your pick. When there is one sensible way, say why the others do not fit.
6. When a quick throwaway build would answer a question faster than talk, offer one. Bring what it teaches back into the conversation. Keeping it is a new request.
7. Write the agreed design: intent, goals and non-goals, constraints, the chosen approach and why, the decisions the user made, and the calls left to the builder. A small feature gets a few lines in the conversation. A larger one gets a file where the repository keeps such documents, or where the user says.
8. Build nothing until the user approves the design. Approval covers only what they saw. Then plan with `/betterpowers:plan`.
