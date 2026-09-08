Technical Debt – Micro Automation Hub

This document records the technical debt accumulated during the development of the Micro Automation Hub. These items represent limitations, postponed features, or architectural compromises that could not be addressed within the scope of the project. Each entry includes a short description and the recommended future improvement.

1. Workflow Scheduling
Description:  
The system currently supports only manual workflow execution. Users cannot schedule workflows to run automatically at fixed intervals or based on triggers.

Future Improvement:  
Introduce a scheduling subsystem (e.g., APScheduler or Celery Beat) to support recurring and event‑driven executions.

2. Limited Block Diversity
Description:  
Only the MVP block set (HTTP Request, Text Transform, Filter, Notification) is implemented.

Future Improvement:  
Extend the block library with parsing blocks, branching logic, authentication blocks, and data‑storage blocks.

3. Minimal Error Visualization
Description:  
Errors are displayed in a basic textual format without detailed diagnostics or visual cues.

Future Improvement:  
Implement structured error objects, UI highlighting, and contextual explanations for failed blocks.

4. No Role‑Based Access Control
Description:  
All users share identical permissions; administrative or multi‑role functionality is not implemented.

Future Improvement:  
Introduce RBAC with differentiated privileges for administrators, editors, and standard users.

5. Basic Template Library
Description:  
Workflow templates are limited to a small set of introductory examples.

Future Improvement:  
Expand the template library to include more advanced automation patterns and domain‑specific workflows.