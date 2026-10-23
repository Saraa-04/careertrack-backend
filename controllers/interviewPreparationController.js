
const mongoose = require("mongoose");
const InterviewPreparation = require("../models/InterviewPreparation");
const Application = require("../models/Application");

// Create a preparation workspace for an application
const createPreparation = async (req, res) => {
  try {
    const { applicationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(400).json({
        message: "Invalid application ID",
      });
    }

    const application = await Application.findOne({
      _id: applicationId,
      user: req.user.userId,
    });

    if (!application) {
      return res.status(404).json({
        message: "Application not found",
      });
    }

    const existingPreparation = await InterviewPreparation.findOne({
      application: applicationId,
      user: req.user.userId,
    });

    if (existingPreparation) {
      return res.status(409).json({
        message: "Preparation workspace already exists",
        preparation: existingPreparation,
      });
    }

    const preparation = await InterviewPreparation.create({
      user: req.user.userId,
      application: applicationId,
    });

    return res.status(201).json({
      message: "Preparation workspace created successfully",
      preparation,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Preparation workspace already exists",
      });
    }

    console.error("Create preparation error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// Get preparation workspace, creating one if it doesn't exist
const getPreparation = async (req, res) => {
  try {
    const { applicationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(400).json({
        message: "Invalid application ID",
      });
    }

    const application = await Application.findOne({
      _id: applicationId,
      user: req.user.userId,
    });

    if (!application) {
      return res.status(404).json({
        message: "Application not found",
      });
    }

    let preparation = await InterviewPreparation.findOne({
      application: applicationId,
      user: req.user.userId,
    });

    if (!preparation) {
      try {
        preparation = await InterviewPreparation.create({
          user: req.user.userId,
          application: applicationId,
        });
      } catch (error) {
        // Another simultaneous request may have created it.
        if (error.code === 11000) {
          preparation = await InterviewPreparation.findOne({
            application: applicationId,
            user: req.user.userId,
          });
        } else {
          throw error;
        }
      }
    }

    if (!preparation) {
      return res.status(500).json({
        message: "Unable to load preparation workspace",
      });
    }

    return res.status(200).json({
      application: {
        _id: application._id,
        company: application.company,
        role: application.role,
      },
      preparation,
    });
  } catch (error) {
    console.error("Get preparation error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// Update preparation workspace
const updatePreparation = async (req, res) => {
  try {
    const { applicationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(400).json({
        message: "Invalid application ID",
      });
    }

    const allowedFields = [
      "interviewDate",
      "interviewType",
      "questions",
      "preparationNotes",
      "revisionTopics",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No valid preparation fields provided",
      });
    }

    const application = await Application.findOne({
      _id: applicationId,
      user: req.user.userId,
    });

    if (!application) {
      return res.status(404).json({
        message: "Application not found",
      });
    }

    const preparation = await InterviewPreparation.findOneAndUpdate(
      {
        application: applicationId,
        user: req.user.userId,
      },
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!preparation) {
      return res.status(404).json({
        message: "Preparation workspace not found. Load it first.",
      });
    }

    return res.status(200).json({
      message: "Preparation updated successfully",
      preparation,
    });
  } catch (error) {
    console.error("Update preparation error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// Delete preparation workspace
const deletePreparation = async (req, res) => {
  try {
    const { applicationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(400).json({
        message: "Invalid application ID",
      });
    }

    const application = await Application.findOne({
      _id: applicationId,
      user: req.user.userId,
    });

    if (!application) {
      return res.status(404).json({
        message: "Application not found",
      });
    }

    const preparation = await InterviewPreparation.findOneAndDelete({
      application: applicationId,
      user: req.user.userId,
    });

    if (!preparation) {
      return res.status(404).json({
        message: "Preparation workspace not found",
      });
    }

    return res.status(200).json({
      message: "Preparation workspace deleted successfully",
    });
  } catch (error) {
    console.error("Delete preparation error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

module.exports = {
  createPreparation,
  getPreparation,
  updatePreparation,
  deletePreparation,
};
