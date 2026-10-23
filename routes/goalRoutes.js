
const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const {
  getGoal,
  updateGoal,
} = require("../controllers/goalController");

// All goal routes require authentication
router.use(protect);

router.get("/", getGoal);
router.put("/", updateGoal);

module.exports = router;
