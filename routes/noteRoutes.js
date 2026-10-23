const express = require("express");

const {
  createNote,
  getNotes,
  getNote,
  updateNote,
  deleteNote,
} = require("../controllers/noteController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

// Create note
router.post("/", protect, createNote);

// Get all notes
router.get("/", protect, getNotes);

// Get single note
router.get("/:id", protect, getNote);

// Update note
router.put("/:id", protect, updateNote);

// Delete note
router.delete("/:id", protect, deleteNote);

module.exports = router;