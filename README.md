# Party Player — Backend

The Party Player backend provides the REST API and Socket.IO server for authenticated watch parties. It stores users, rooms, playlists, chat messages, and room history in MongoDB. Redis is used for the Socket.IO adapter and shared real-time events.

## Stack

- Node.js and TypeScript
- Express 5
- MongoDB with Mongoose
- Redis with ioredis and the Socket.IO Redis adapter
- Socket.IO
- JWT authentication and bcryptjs password hashing
- Zod validation
- Helmet, CORS, and Morgan

## Requirements

- Node.js with npm
- A MongoDB instance
- A Redis instance

## Setup and run locally

From this directory:

```bash
npm install
```

Create `Back-end/.env` with the required settings:

```dotenv
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/party-player
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
ROOM_CODE_LENGTH=6
```

`PORT`, `MONGODB_URI`, `REDIS_URL`, `JWT_SECRET`, and `CLIENT_URL` are required by the server. `NODE_ENV`, `JWT_EXPIRES_IN`, `ROOM_CODE_LENGTH`, and `CORS_ORIGINS` are optional. CORS allows `http://localhost:5173` and `https://endearing-sprinkles-c1c952.netlify.app` by default; `CLIENT_URL` and the optional comma-separated `CORS_ORIGINS` add deployment-specific origins. The same allowlist is used by the REST API and Socket.IO. Keep real secrets out of source control.

Start the development server:

```bash
npm run dev
```

The server connects to MongoDB and Redis before listening. By default, the API is at `http://localhost:5000/api`, the health check is at `http://localhost:5000/health`, and Socket.IO is attached to the same origin.

## Deploy to Render

The repository-level [`render.yaml`](../render.yaml) defines the API web service, frontend static site, and Redis-compatible Key Value instance. In Render, create a Blueprint from the repository and provide `MONGODB_URI` when prompted. Use a reachable MongoDB connection string, such as one from MongoDB Atlas, and allow connections from the Render service in the database network settings.

The Blueprint uses Node.js 22, builds the API with `npm ci && npm run build`, starts it with `npm start`, and checks `/health`. It wires the frontend origin into the API's `CLIENT_URL`, and wires the API URL into both frontend build variables. The API binds to Render's `PORT` automatically. Keep the API, frontend, and Key Value services in the same Render Blueprint; the API service currently uses in-memory room state, so do not scale it horizontally without first moving room state to a shared store.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run the server with `tsx` watch mode. |
| `npm run build` | Compile TypeScript with `tsc`. |
| `npm start` | Run the compiled `dist/server.js`; build first. |

There is no configured automated test suite in this package yet.

## REST API

All routes except `GET /health`, `POST /api/auth/register`, and `POST /api/auth/login` require a bearer access token. Send authenticated requests with `Authorization: Bearer <token>`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check. |
| `POST` | `/api/auth/register` | Register an account. |
| `POST` | `/api/auth/login` | Log in and receive authentication data. |
| `GET` | `/api/auth/me` | Get the authenticated user. |
| `POST` | `/api/rooms/create` | Create a room. |
| `POST` | `/api/rooms/join` | Join a room. |
| `GET` | `/api/rooms/my-rooms` | List the user's rooms. |
| `GET` | `/api/rooms/:code` | Get a room by code. |
| `DELETE` | `/api/rooms/:id` | Close a room. |
| `GET` | `/api/history/me` | Get the user's room history. |
| `GET` | `/api/playlists` | List saved playlists. |
| `POST` | `/api/playlists` | Create a playlist. |
| `PUT` | `/api/playlists/:id` | Update a playlist. |
| `DELETE` | `/api/playlists/:id` | Delete a playlist. |
| `POST` | `/api/playlists/:id/items` | Add an item to a playlist. |

## Real-time rooms

Socket.IO clients authenticate with the JWT token in the handshake `auth.token` field. The socket server handles room membership, synchronized playback, participant roles, chat, reactions, and audio state. Redis adapter support allows Socket.IO events to be shared across server instances.

## Project layout

```text
src/
  config/       Environment, database, Redis, and CORS configuration
  db/models/    Mongoose models
  modules/      REST route, controller, service, and validation modules
  socket/       Socket.IO setup, room classes, middleware, and event handlers
  types/        Express and Socket.IO type extensions
  utils/        API errors, async helpers, JWT, logging, and room codes
```
