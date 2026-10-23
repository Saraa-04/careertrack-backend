const Note = require("../models/note");

// CREATE NOTE
const createNote = async (req, res) => {
  try {
    const { title, content } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof content !== "string" ||
      !content.trim()
    ) {
      return res.status(400).json({
        message: "Please provide a valid title and content",
      });
    }

    const note = await Note.create({
      title: title.trim(),
      content: content.trim(),
      user: req.user.userId,
    });

    return res.status(201).json({
      message: "Note created successfully",
      note,
    });
  } catch (error) {
    console.error("Create note error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// GET ALL NOTES
const getNotes = async (req, res) => {
  try {
    const notes = await Note.find({
      user: req.user.userId,
    }).sort({ createdAt: -1 });

    return res.status(200).json({ notes });
  } catch (error) {
    console.error("Get notes error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// GET SINGLE NOTE
const getNote = async (req, res) => {
  try {
    const note = await Note.findOne({
      _id: req.params.id,
      user: req.user.userId,
    });

    if (!note) {
      return res.status(404).json({
        message: "Note not found",
      });
    }

    return res.status(200).json({ note });
  } catch (error) {
    console.error("Get note error:", error);

    const isInvalidId = error.name === "CastError";

    return res.status(isInvalidId ? 400 : 500).json({
      message: isInvalidId ? "Invalid note ID" : "Server error",
    });
  }
};

// UPDATE NOTE
const updateNote = async (req, res) => {
  try {
    const { title, content } = req.body;

    if (
      (title !== undefined &&
        (typeof title !== "string" || !title.trim())) ||
      (content !== undefined &&
        (typeof content !== "string" || !content.trim()))
    ) {
      return res.status(400).json({
        message: "Title and content must be non-empty strings",
      });
    }

    const note = await Note.findOne({
      _id: req.params.id,
      user: req.user.userId,
    });

    if (!note) {
      return res.status(404).json({
        message: "Note not found",
      });
    }

    if (title !== undefined) note.title = title.trim();
    if (content !== undefined) note.content = content.trim();

    await note.save();

    return res.status(200).json({
      message: "Note updated successfully",
      note,
    });
  } catch (error) {
    console.error("Update note error:", error);

    const isInvalidId = error.name === "CastError";

    return res.status(isInvalidId ? 400 : 500).json({
      message: isInvalidId ? "Invalid note ID" : "Server error",
    });
  }
};

// DELETE NOTE
const deleteNote = async (req, res) => {
  try {
    const note = await Note.findOneAndDelete({
      _id: req.params.id,
      user: req.user.userId,
    });

    if (!note) {
      return res.status(404).json({
        message: "Note not found",
      });
    }

    return res.status(200).json({
      message: "Note deleted successfully",
    });
  } catch (error) {
    console.error("Delete note error:", error);

    const isInvalidId = error.name === "CastError";

    return res.status(isInvalidId ? 400 : 500).json({
      message: isInvalidId ? "Invalid note ID" : "Server error",
    });
  }
};

module.exports = {
  createNote,
  getNotes,
  getNote,
  updateNote,
  deleteNote,
};