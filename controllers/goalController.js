const Goal = require("../models/Goal");

// @desc    Get the logged-in user's weekly goal
// @route   GET /api/goals
// @access  Private
const getGoal = async (req, res) => {
  try {
    let goal = await Goal.findOne({ user: req.user.userId });

    // Create a default goal the first time it is requested
    if (!goal) {
      goal = await Goal.create({
        user: req.user.userId,
        weeklyApplicationTarget: 10,
      });
    }

    return res.status(200).json({
      message: "Weekly goal retrieved successfully",
      goal: {
        weeklyApplicationTarget: goal.weeklyApplicationTarget,
      },
    });
  } catch (error) {
    console.error("Get goal error:", error.message);
    return res.status(500).json({
      message: "Unable to retrieve weekly goal",
    });
  }
};

// @desc    Update the logged-in user's weekly goal
// @route   PUT /api/goals
// @access  Private
const updateGoal = async (req, res) => {
  try {
    const target = Number(req.body.weeklyApplicationTarget);

    if (
      req.body.weeklyApplicationTarget === undefined ||
      req.body.weeklyApplicationTarget === null ||
      req.body.weeklyApplicationTarget === "" ||
      !Number.isInteger(target) ||
      target < 1 ||
      target > 100
    ) {
      return res.status(400).json({
        message: "Weekly target must be a whole number between 1 and 100",
      });
    }

    const goal = await Goal.findOneAndUpdate(
      { user: req.user.userId },
      { $set: { weeklyApplicationTarget: target } },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(200).json({
      message: "Weekly goal updated successfully",
      goal: {
        weeklyApplicationTarget: goal.weeklyApplicationTarget,
      },
    });
  } catch (error) {
    console.error("Update goal error:", error.message);
    return res.status(500).json({
      message: "Unable to update weekly goal",
    });
  }
};

module.exports = {
  getGoal,
  updateGoal,
};
