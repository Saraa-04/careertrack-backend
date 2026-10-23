const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");

dotenv.config();

connectDB();

const app = express();

// Security settings
app.disable("x-powered-by");

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  })
);

app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log("REQUEST:", req.method, req.url);
  next();
});

// Authentication routes
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

// Weekly goal routes
const goalRoutes = require("./routes/goalRoutes");
app.use("/api/goals", goalRoutes);
console.log("GOAL ROUTES REGISTERED");

// Notes routes
const noteRoutes = require("./routes/noteRoutes");
app.use("/api/notes", noteRoutes);

// Interview preparation routes
const interviewPreparationRoutes = require("./routes/interviewPreparationRoutes");
app.use("/api/interview-preparation", interviewPreparationRoutes);

// Application routes
const applicationRoutes = require("./routes/applicationRoutes");
app.use("/api/applications", applicationRoutes);
console.log("APPLICATION ROUTES REGISTERED");

// Root route
app.get("/", (req, res) => {
  res.send("CareerTrack Backend is running successfully!");
});

// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error(err);

  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || err.statusCode || 500;

  res.status(status).json({
    message:
      status >= 400 && status < 500
        ? err.message
        : "Server error",
  });
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});