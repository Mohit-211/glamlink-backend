const express = require("express");
const router = express.Router();

const { podcastScheduleController } = require('../../../controllers');


router.post("/create", podcastScheduleController.createPodcastSchedule);
router.get("/list", podcastScheduleController.getPodcastSchedules);
router.get("/:id", podcastScheduleController.getPodcastScheduleById);
router.put("/update/:id", podcastScheduleController.updatePodcastSchedule);
router.delete("/delete", podcastScheduleController.deletePodcastSchedule);

module.exports = router;