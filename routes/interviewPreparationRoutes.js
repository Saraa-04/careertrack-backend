
const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  createPreparation,
  getPreparation,
  updatePreparation,
  deletePreparation,
} = require("../controllers/interviewPreparationController");

router.post("/:applicationId", protect, createPreparation);

router.get("/:applicationId", protect, getPreparation);

router.put("/:applicationId", protect, updatePreparation);

router.delete("/:applicationId", protect, deletePreparation);

module.exports = router;
