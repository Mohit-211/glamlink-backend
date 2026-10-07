const httpStatus = require('http-status');
const momentTz = require('moment-timezone');
const Sequelize = require('sequelize');

const { User, Case, Appointment, CaseAttachment, Slot, UserAttachment, Profile } = require('../../models');
const ApiError = require('../../utils/ApiError');
const config = require('../../config/config');
const moment = require('moment');
const { caseTypes, appointmentTypes } = require('../../config/types');



const getAllCase = async (body) => {
    try {
        const { user } = body;
        let where = { is_active: true, status: caseTypes.ACCEPTED };

        if (user.role_id === Number(config.CLLR_ROLE_ID)) {
            where['counselor_id'] = user.id;
        } else if (user.role_id === Number(config.USR_ROLE_ID)) {
            where['user_id'] = user.id;
        }

        const caseDocs = await Case.findAll({
            where: where,
            include: [
                {
                    model: User,
                    as: user.role_id === Number(config.CLLR_ROLE_ID) ? 'filled_to' : 'filled_by',
                    attributes: ['id', 'role_id'],
                    include: [
                        {
                            model: Profile,
                            as: 'user_profile',
                            attributes: ['id', 'name', 'qualification', 'language', 'mobile', 'is_active', 'created_at', 'about', 'overall_ratings', 'no_of_user_rated', 'no_of_user_reviewed'],
                        },
                        {
                            model: UserAttachment,
                            as: 'user_attachments',
                            attributes: ['id', 'title', 'file_type', 'file_name', 'file_uri', 'role_id'],
                            order: [['id', 'desc']],
                            limit: 1,
                            where: {title : 'Profile Image'},
                        },
                    ],
                },
            ],
            order: [['id', 'DESC']]
        });
        if (!caseDocs) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get all cases');
        };
        return caseDocs;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const caseDetail = async (body, params, header) => {
    try {
        const { user } = body;
        const { caseId } = params;
        const { timezone } = header;

        if (!caseId) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Invalid Case Id');
        let where = { is_active: true, status: caseTypes.ACCEPTED, id: caseId };

        if (user.role_id === Number(config.CLLR_ROLE_ID)) {
            where['counselor_id'] = user.id;
        } else if (user.role_id === Number(config.USR_ROLE_ID)) {
            where['user_id'] = user.id;
        }


        let caseDoc = await Case.findOne({
            where: where,
            include: [
                {
                    model: CaseAttachment,
                    as: 'case_attachments',
                    attributes: ['id', 'title', 'file_type', 'file_name', 'file_uri', 'case_id', 'created_at', [Sequelize.fn('DATE_FORMAT', Sequelize.col('CaseAttachment.created_at'), '%d %b %Y %h:%i%p'), 'formatted_created_at']],
                    limit: 3,
                    order: [['id', 'DESC']]
                },
                {
                    model: User,
                    as: user.role_id === Number(config.CLLR_ROLE_ID) ? 'filled_to' : 'filled_by',
                    attributes: ['id', 'role_id'],
                    include: [
                        {
                            model: Profile,
                            as: 'user_profile',
                            attributes: ['id', 'name', 'qualification', 'language', 'mobile', 'is_active', 'created_at', 'about', 'overall_ratings', 'no_of_user_rated', 'no_of_user_reviewed'],
                        },
                        {
                            model: UserAttachment,
                            as: 'user_attachments',
                            attributes: ['id', 'title', 'file_type', 'file_name', 'file_uri', 'role_id'],
                            order: [['id', 'desc']],
                            limit: 1,
                            where: {title : 'Profile Image'},
                        },
                    ],
                },
                {
                    model: Appointment,
                    as: 'case_appointments',
                    attributes: ['id', 'user_id', 'counselor_id', 'slot_id', 'case_id', 'notes', 'call_type', 'slot_duration_in_minuites', 'total_amount', 'is_active', 'is_user_canceled', 'is_counselor_canceled', 'is_term_form_accepted_by_user', 'status', 'is_counselor_joined', 'is_user_joined', 'is_user_canceled', 'is_counselor_canceled', 'is_payment_done', 'is_rescheduled_done', 'is_refund_needed', 'timing_status'],
                    include: [
                        {
                            model: User,
                            as: user.role_id === Number(config.CLLR_ROLE_ID) ? 'appointment_counselor' : 'appointment_user',
                            attributes: ['id', 'role_id'],
                            include: [
                                {
                                    model: Profile,
                                    as: 'user_profile',
                                    attributes: ['id', 'name', 'qualification', 'language', 'mobile', 'is_active', 'created_at', 'about', 'overall_ratings', 'no_of_user_rated', 'no_of_user_reviewed'],
                                },
                                {
                                    model: UserAttachment,
                                    as: 'user_attachments',
                                    attributes: ['id', 'title', 'file_type', 'file_name', 'file_uri', 'role_id'],
                                    order: [['id', 'desc']],
                                    limit: 1,
                                    where: {title : 'Profile Image'},
                                },
                            ],
                        },
                        {
                            model: Slot,
                            as: 'appointment_slot',
                            attributes: ['id', 'remaining_appointment', 'time_zone', 'slot_date_local', 'slot_start_time_local', 'is_booked', 'is_available']
                        }
                    ]
                }
            ],

        });
        if (!caseDoc) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Invalid Case id');
        };

        let caseAppointments = caseDoc.case_appointments.map(appointment => {
            const appointmentTimezone = appointment.appointment_slot.time_zone;
            const slotStartTimeLocal = appointment.appointment_slot.slot_start_time_local;
            const slotDateLocal = appointment.appointment_slot.slot_date_local;

            const startTimeWithDate = momentTz.tz(`${slotDateLocal} ${slotStartTimeLocal}`, 'YYYY-MM-DD HH:mm:ss', appointmentTimezone).tz(timezone).format('DD MMMM hh:mm:ss A');
            const currentTime = moment.tz(new Date(), timezone);
            const appointmentTime = moment.tz(`${slotDateLocal} ${slotStartTimeLocal}`, 'YYYY-MM-DD HH:mm:ss', appointmentTimezone).tz(timezone);

            // Determine if the appointment is upcoming or completed
            const isUpcoming = currentTime.isBefore(appointmentTime);
            const isCompleted = currentTime.isAfter(appointmentTime);

            return { ...appointment.dataValues, start_time_with_date: startTimeWithDate, is_upcoming: isUpcoming, is_completed: isCompleted };
        });
        delete caseDoc.dataValues.case_appointments;
        caseDoc.dataValues['case_appointments_data'] = caseAppointments;
        return caseDoc;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const addAttachmentToCase = async (body, files) => {
    try {
        const { user, case_id } = body;
        if (user.role_id !== Number(config.CLLR_ROLE_ID)) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Only Counselor can access this route.');
        };

        const caseDoc = await Case.findOne({ where: { id: case_id, is_active: true, counselor_id: user.id } });
        if (!caseDoc || Object.keys(caseDoc).length === 0) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Case Doc Not Found');
        };

        if (files && Object.keys(files).length !== 0) {
            for (const fileType in files) {
                if (Object.prototype.hasOwnProperty.call(files, fileType)) {
                    for (let i = 0; i < files[fileType].length; i++) {
                        const currFile = files[fileType][i];

                        const caseAttachmentObj = {
                            case_id: caseDoc.id,
                            title: getTitle(fileType.toLowerCase()),
                            file_type: getFileType(fileType),
                            file_name: currFile.filename,
                            file_uri: `/${fileType}`,
                            file_size: currFile.size
                        };

                        await CaseAttachment.create(caseAttachmentObj);
                    }
                }
            }
        }
        return '';

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

function getFileType(fileType) {
    switch (fileType) {
        case 'images':
            return 'Image';
        case 'gifs':
            return 'Gif';
        case 'videos':
            return 'Video';
        case 'docs':
            return 'Document';
        case 'audios':
            return 'Audio';
        default:
            return 'Other';
    }
};

// Function to get dynamic title based on attachmentType
function getTitle(attachmentType) {
    switch (attachmentType) {
        case 'images':
            return 'Case Image';
        case 'gifs':
            return 'Case Gif';
        case 'videos':
            return 'Case Video';
        case 'docs':
            return 'Case Document';
        case 'audios':
            return 'Case Audio';
        default:
            return 'Case Attachment';
    }
};


const getAllCaseAttachments = async (body, params, header) => {
    try {
        const { user } = body;
        const { caseId } = params;
        const { timezone } = header;

        if (!caseId) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Invalid Case Id');
        let where = { is_active: true, case_id: caseId };



        let caseAttachmentDoc = await CaseAttachment.findAll({
            where: where,
            attributes: ['id', 'title', 'file_type', 'file_name', 'file_uri', 'case_id', 'created_at', [Sequelize.fn('DATE_FORMAT', Sequelize.col('CaseAttachment.created_at'), '%d %b %Y %h:%i%p'), 'formatted_created_at']],
            order: [['id', 'DESC']]
        });
        if (!caseAttachmentDoc) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Invalid Case id');
        };

        return caseAttachmentDoc;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const serviceCompleteFlag = async (body, header) => {
    try {
        const { user,case_id } = body;
        const { timezone } = header;

        if (!case_id) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Please Provide a valid Case Id');
        let where = { is_active: true, id: case_id };
        let caseDoc = await Case.findOne({ where: where })
        if (!caseDoc) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Case Not Found');
        };

        if (user.role_id !== Number(config.USR_ROLE_ID) || caseDoc.user_id !== user.id) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Only user can access this.');
        };

        caseDoc.status = caseTypes.COMPLETED;
        caseDoc.save();
        return caseDoc;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};


module.exports = {
    getAllCase,
    caseDetail,
    addAttachmentToCase,
    getAllCaseAttachments,
    serviceCompleteFlag,
};
