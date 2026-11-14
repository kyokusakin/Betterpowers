---
name: debug
description: Find the root cause of a bug, failing test, crash, or unexpected behavior before changing code.
---

1. Reproduce the failure on demand. If it cannot be reproduced, say what was tried.
2. Trace the failing path end to end and find where actual and expected behavior first diverge.
3. Test one hypothesis at a time with the cheapest observation: a log line, a debugger, a minimal input. Change one thing per experiment.
4. When the user asks whether something really happened, or says to stop guessing, you assumed without checking: go back to step 1. After three disproved hypotheses, stop patching. Re-check the assumptions and the design, and tell the user what is known.
5. Fix at the root, in the code every caller goes through. Check every caller of what you change.
6. Prove the fix: the reproduction now behaves correctly. Add a behavior test when the bug could return.
7. Report the cause, the fix, and the evidence. If the root cause is not confirmed, say so.
