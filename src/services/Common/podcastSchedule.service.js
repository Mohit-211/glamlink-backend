
const httpStatus = require("http-status");
const moment = require("moment");
const {  PodcastSchedule, JournalTopic } = require("../../models");
const ApiError = require("../../utils/ApiError");


const createPodcastSchedule = async (reqBody) => {
	try {
		const scheduleObj = {
			name: reqBody.name,
			short_description: reqBody.short_description,
			schedule_date: reqBody.schedule_date,
			created_at: moment(),
		};

		const scheduleDoc = await PodcastSchedule.create(scheduleObj);

		if (!scheduleDoc) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to create podcast schedule"
			);
		}

		return scheduleDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getPodcastSchedules = async () => {
	try {
		const today = moment().format("YYYY-MM-DD");

		const schedules = await PodcastSchedule.findAll({
			where: {
				is_active: true,
			},
			order: [
				[
					PodcastSchedule.sequelize.literal(`
						CASE
							WHEN schedule_date >= '${today}' THEN 0
							ELSE 1
						END
					`),
					"ASC",
				],
				[
					PodcastSchedule.sequelize.literal(`
						CASE
							WHEN schedule_date >= '${today}' THEN schedule_date
						END
					`),
					"ASC",
				],
				[
					PodcastSchedule.sequelize.literal(`
						CASE
							WHEN schedule_date < '${today}' THEN schedule_date
						END
					`),
					"DESC",
				],
			],
		});

		return schedules;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getPodcastScheduleById = async (id) => {
  try {
    const scheduleDoc = await PodcastSchedule.findOne({
      where: {
        id,
        is_active: true,
      },
      include: [
        {
          model: JournalTopic,
          as: "journal_topics",
          attributes: ["id", "name", "slug"],
          through: {
            attributes: ["id", "sort_order"],
          },
          required: false,
        },
      ],
    });

    if (!scheduleDoc) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Podcast schedule not found"
      );
    }

    return scheduleDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message
    );
  }
};

const updatePodcastSchedule = async (id, reqBody) => {
	try {
		const scheduleDoc = await PodcastSchedule.findOne({
			where: {
				id,
				is_active: true,
			},
		});

		if (!scheduleDoc) {
			throw new ApiError(
				httpStatus.NOT_FOUND,
				"Podcast schedule not found"
			);
		}

		await scheduleDoc.update({
			name: reqBody.name || scheduleDoc.name,
			short_description:
				reqBody.short_description ||
				scheduleDoc.short_description,

			schedule_date:
				reqBody.schedule_date ||
				scheduleDoc.schedule_date,

			updated_at: moment(),
		});

		return scheduleDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deletePodcastSchedule = async (ids) => {
	try {
		if (!ids || !ids.length) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"Please provide ids"
			);
		}

		await PodcastSchedule.destroy({
			where: {
				id: ids,
			},
		});

		return true;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

module.exports = {
	createPodcastSchedule,
	getPodcastSchedules,
	getPodcastScheduleById,
	updatePodcastSchedule,
	deletePodcastSchedule

};