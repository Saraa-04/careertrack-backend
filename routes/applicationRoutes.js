
const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  createApplication,
  getApplications,
  updateApplication,
  deleteApplication,
} = require("../controllers/applicationController");

router.use(protect);

router.post("/", createApplication);
router.get("/", getApplications);
router.put("/:id", updateApplication);
router.delete("/:id", deleteApplication);

module.exports = router;