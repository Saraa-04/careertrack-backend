# CareerTrack Backend

REST API for **CareerTrack**, a job-search tracker for managing applications, deadlines and interview preparation. It handles authentication, applications, weekly goals, interview preparation and notes.

**Live app:** https://careertrack-app.onrender.com
**Frontend repository:** https://github.com/Saraa-04/careertrack-frontend

> The API runs on Render's free plan, so the first request after a quiet period can take 30-60 seconds while the server wakes up.

## Features

- **Authentication:** register and log in with JWT; passwords hashed with bcrypt.
- **Applications:** create, read, update and delete job applications, each with a status and deadline.
- **Goals:** read and update a weekly application target.
- **Interview preparation:** one workspace per application (interview date and type, notes, question bank, revision checklist).
- **Notes:** create, read, update and delete free-form notes.
- **User-specific data:** every route except auth requires a valid bearer token, and each user only accesses their own records.

## Tech stack

| Area | Choice |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Express 5 |
| Database | MongoDB with Mongoose |
| Auth | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` |
| Config | `dotenv` |
| Other | `cors`, `nodemon` (development) |

## Project structure

config/        Database connection and app configuration
controllers/   Request handlers for each API area
middleware/    Authentication and shared middleware
models/        Mongoose schemas
routes/        Route definitions
scripts/       Backend verification script
postman/       Postman collection for testing the API
server.js      App entry point

## Getting started

Requirements: Node 20+ and a MongoDB database (local or MongoDB Atlas).

```bash
git clone https://github.com/Saraa-04/careertrack-backend.git
cd careertrack-backend
npm install
```

Create a `.env` file in the project root:

```
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=a_long_random_secret
```

Then start the server:

```bash
npm run dev     # development, restarts on changes
npm start       # production
```

The API runs at `http://localhost:5000/api` by default.

### Scripts

| Command | What it does |
|---|---|
| `npm start` | Start the server |
| `npm run dev` | Start the server with nodemon |
| `npm run verify` | Run the backend verification script |

## API endpoints

All routes are prefixed with `/api`. Every route except auth expects an `Authorization: Bearer <token>` header.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login` (returns `token`) |
| Applications | `GET/POST /applications`, `PUT/DELETE /applications/:id` |
| Notes | `GET/POST /notes`, `PUT/DELETE /notes/:id` |
| Goals | `GET/PUT /goals` (`weeklyApplicationTarget`) |
| Interview prep | `GET/POST/PUT/DELETE /interview-preparation/:applicationId` |

## Deployment

Deployed on Render. Set `MONGO_URI` and `JWT_SECRET` in the host's environment settings, and allow the Render service to connect to your MongoDB database.

## Known limitations

- No automated test suite yet beyond the verification script.
- Rate limiting and input validation can be extended.
- Interview preparation is fetched per application; a single summary endpoint would reduce requests.

## Roadmap

- Add automated tests for the auth and goals logic
- Add an "applied on" date to applications
- Add a summary endpoint for the dashboard
