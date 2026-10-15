const express = require("express");
const router = express.Router();
const { requireAdmin } = require('../../shared/admin');

const podcastScheduleController = require('./podcastSchedule.controller');


router.post("/create", requireAdmin, podcastScheduleController.createPodcastSchedule);
router.get("/list", podcastScheduleController.getPodcastSchedules);
router.get("/:id", podcastScheduleController.getPodcastScheduleById);
router.put("/update/:id", requireAdmin, podcastScheduleController.updatePodcastSchedule);
router.delete("/delete", requireAdmin, podcastScheduleController.deletePodcastSchedule);

module.exports = router;