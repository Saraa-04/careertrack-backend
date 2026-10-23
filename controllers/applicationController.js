
const mongoose = require("mongoose");
const Application = require("../models/Application");

const ALLOWED_STATUSES = [
  "Wishlist",
  "Applied",
  "Assessment",
  "Interview",
  "Offer",
  "Rejected",
];

const ALLOWED_FIELDS = [
  "company",
  "role",
  "status",
  "jobLink",
  "deadline",
  "notes",
];

// Validate application data before sending it to MongoDB
const validateApplicationData = (body, isUpdate = false) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be a valid object";
  }

  // Company and role are required when creating an application.
  if (!isUpdate && (!body.company || !body.role)) {
    return "Company and role are required";
  }

  // Validate fields only when they are provided.
  if (body.company !== undefined) {
    if (
      typeof body.company !== "string" ||
      !body.company.trim()
    ) {
      return "Company must be a non-empty string";
    }
  }

  if (body.role !== undefined) {
    if (
      typeof body.role !== "string" ||
      !body.role.trim()
    ) {
      return "Role must be a non-empty string";
    }
  }

  if (
    body.status !== undefined &&
    (typeof body.status !== "string" ||
      !ALLOWED_STATUSES.includes(body.status))
  ) {
    return "Invalid application status";
  }

  // Deadline may be empty, null, or a valid date.
  if (
    body.deadline !== undefined &&
    body.deadline !== null &&
    body.deadline !== ""
  ) {
    if (
      typeof body.deadline !== "string" ||
      Number.isNaN(Date.parse(body.deadline))
    ) {
      return "Deadline must be a valid date";
    }
  }

  // Prevent objects and other unexpected values in text fields.
  for (const field of ["jobLink", "notes"]) {
    if (
      body[field] !== undefined &&
      body[field] !== null &&
      typeof body[field] !== "string"
    ) {
      return `${field} must be a string`;
    }
  }

  return null;
};

// Return a safe validation error instead of exposing database details.
const handleControllerError = (error, res, action) => {
  console.error(`Application ${action} error:`, error);

  if (
    error.name === "ValidationError" ||
    error.name === "CastError"
  ) {
    return res.status(400).json({
      message: "Invalid application data",
    });
  }

  return res.status(500).json({
    message: `Failed to ${action} application`,
  });
};

// Create a new application
const createApplication = async (req, res) => {
  const validationError = validateApplicationData(req.body);

  if (validationError) {
    return res.status(400).json({
      message: validationError,
    });
  }

  try {
    const { company, role, status, jobLink, deadline, notes } =
      req.body;

    const application = await Application.create({
      user: req.user.userId,
      company: company.trim(),
      role: role.trim(),
      ...(status !== undefined && { status }),
      jobLink: jobLink ?? "",
      deadline: deadline || null,
      notes: notes ?? "",
    });

    return res.status(201).json({
      message: "Application created successfully",
      application,
    });
  } catch (error) {
    return handleControllerError(error, res, "create");
  }
};

// Get all applications for the logged-in user
const getApplications = async (req, res) => {
  try {
    const applications = await Application.find({
      user: req.user.userId,
    }).sort({ createdAt: -1 });

    return res.status(200).json({ applications });
  } catch (error) {
    return handleControllerError(error, res, "fetch");
  }
};

// Update an application
const updateApplication = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      message: "Invalid application ID",
    });
  }

  const validationError = validateApplicationData(req.body, true);

  if (validationError) {
    return res.status(400).json({
      message: validationError,
    });
  }

  try {
    const application = await Application.findOne({
      _id: req.params.id,
      user: req.user.userId,
    });

    if (!application) {
      return res.status(404).json({
        message: "Application not found",
      });
    }

    ALLOWED_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "deadline") {
          application[field] = req.body[field] || null;
        } else if (
          (field === "company" || field === "role") &&
          typeof req.body[field] === "string"
        ) {
          application[field] = req.body[field].trim();
        } else {
          application[field] = req.body[field];
        }
      }
    });

    await application.save();

    return res.status(200).json({
      message: "Application updated successfully",
      application,
    });
  } catch (error) {
    return handleControllerError(error, res, "update");
  }
};

// Delete an application
const deleteApplication = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      message: "Invalid application ID",
    });
  }

  try {
    const application = await Application.findOneAndDelete({
      _id: req.params.id,
      user: req.user.userId,
    });

    if (!application) {
      return res.status(404).json({
        message: "Application not found",
      });
    }

    return res.status(200).json({
      message: "Application deleted successfully",
    });
  } catch (error) {
    return handleControllerError(error, res, "delete");
  }
};

module.exports = {
  createApplication,
  getApplications,
  updateApplication,
  deleteApplication,
};
