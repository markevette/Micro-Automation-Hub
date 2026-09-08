Installation and Run Instructions – Micro Automation Hub

These instructions describe how to install, configure, and run the Micro Automation Hub using Docker and docker‑compose. The steps ensure reproducibility across environments and support evaluation of the application.

1. Prerequisites
Docker installed

Docker Compose installed

Internet connection (required for pulling base images)

2. Clone the Repository
Code
git clone https://github.com/markevette/Micro-Automation-Hub.git
cd Micro-Automation-Hub/infrastructure

3. Environment Configuration
Copy the example environment file:

Code
cp env.example .env
Adjust values as needed (database credentials, email provider settings).

4. Build and Start the Application
Run the following command from the infrastructure directory:

Code
docker-compose up --build
This starts:

Backend (FastAPI) on http://localhost:8000

Frontend (React) on http://localhost:3000

PostgreSQL database on localhost:5432

5. Access the Application
Open your browser and navigate to:

Code
http://localhost:3000
You can now register a user, create workflows, and execute automations.

6. Stopping the Application
Code
docker-compose down
7. Cloud Deployment
For cloud deployment, upload the same docker‑compose configuration to your hosting provider (e.g., Render, Railway, or a VM). Ensure environment variables are configured identically.

8. Troubleshooting
If containers fail to start, ensure no other services are using ports 3000, 8000, or 5432.

If the backend cannot connect to the database, verify .env credentials.

If the frontend cannot reach the backend, confirm CORS settings in FastAPI.