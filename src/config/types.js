const userStatusTypes = {
    ACCEPTED: 'ACCEPTED',
    PENDING: 'PENDING',
    REJECTED: 'REJECTED',
    REVIEWING: 'REVIEWING',
    REVIEWED: 'REVIEWED',
};

const paymentModeTypes = {
    CREDIT_CARD: 'CREDIT_CARD',
    DEBIT_CARD: 'DEBIT_CARD',
    PHONE_PAY: 'PHONE_PAY',
    GOOGLE_PAY: 'GOOGLE_PAY',
    APPLE_PAY: 'APPLE_PAY',
    BANK_ACCOUNT: 'BANK_ACCOUNT',
    CARD: 'CARD',
    UNKNOWN: 'UNKNOWN',
};

const otpTypes = {
    EMAIL_VERIFICATION: 'email_varification',
    MOBILE_VERIFICATION: 'mobile_varification',
    FORGOT_PASSWORD: 'forgot_password',
    RESET_PASSWORD: 'reset_password'
};

const paymentStatusTypes = {
    PENDING: 'PENDING',
    SUCCESS: 'SUCCESS',
    REJECTED: 'REJECTED',
    REFUNDED: 'REFUNDED',
    CANCELLED: 'CANCELLED',
};

const rolesTypes = {
    ADM: 'Admin',
    SUP_ADM: 'Super Admin',
    SUB_ADM: 'Sub Admin',
    ENG: 'Engineer',
    EDTR: 'Editor',
    User: 'User',
    CLLR: 'Counselor'
};

const bookingTypes = {
    PENDING: 'PENDING',
    SUCCESS: 'SUCCESS',
    REJECTED: 'REJECTED',
    ESTIMATE: 'ESTIMATE'
};

const tokenTypes = {
    ACCESS: 'access',
    REFRESH: 'refresh',
    VERIFY_EMAIL: 'email_varification',
    FORGOT_PASSWORD: 'forgot_password',
    RESET_PASSWORD: 'reset_password',
    SESSION: 'session',
};

const currancyTypes = {
    USD: 'USD',
    INR: 'INR',
    EUR: 'EUR',
    OMR: 'OMR',
    CHF: 'CHF',
    KYD: 'KYD'
};
const currancyTypesArr = ['USD', 'INR', 'EUR', 'OMR', 'CHF', 'KYD'];

const caseTypes = {
    ACCEPTED: 'ACCEPTED',
    PENDING: 'PENDING',
    ONGOING: 'ON-GOING',
    COMPLETED: 'COMPLETED',
    REJECTED: 'REJECTED',
    TRIAL: 'TRIAL'
};


const appointmentTypes = {
    PENDING: 'PENDING',
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    UPCOMING: 'UPCOMING',
    CANCELED: 'CANCELED',
    ONGOING: 'ONGOING',
    COMPLETED: 'COMPLETED',
    RESCHEDULED: 'RESCHEDULED',
    TODAY: 'TODAY'
};

const notificationTypes = {
    appointmentBooked: 'APPOINTMENT-BOOKED',
    appointmentRequest: 'APPOINTMENT-REQUEST',
    appointmentCanceled: 'APPOINTMENT-CANCELED',
    appointmentRescheduled: 'APPOINTMENT-RESCHEDULED',
    incomingMessage: 'INCOMING-MESSAGE',
    trialBooked: 'TRIAL-BOOKED',
    trialCanceled: 'TRIAL-CANCELED',
    subscribed: 'SUBSCRIBED',
    unSubscribed: 'UN-SUBSCRIBED',
    postComment: 'POST-COMMENT',
    postShare: 'POST-SHARE',
    postLike: 'POST-LIKE',
    addReview: 'ADD-REVIEW',
    follow: 'FOLLOW',
    unfollow: 'UN-FOLLOW',
    reelLike: 'REEL-LIKE',
    reelComment: 'REEL-COMMENT',

    albumLike: 'ALBUM-LIKE',
    albumComment: 'ALBUM-COMMENT',
    albumAttachmentLike: 'ALBUM-ATTACHMENT-LIKE',
    albumAttachmentComment: 'ALBUM-ATTACHMENT-COMMENT',

    reviewLike: 'REVIEW-LIKE',
    reviewComment: 'REVIEW-COMMENT',


    orderPlaced: 'ORDER-PLACED',
};

const notificationTypesArr = ['APPOINTMENT-REQUEST', 'APPOINTMENT-BOOKED', 'APPOINTMENT-CANCELED', 'APPOINTMENT-RESCHEDULED', 'INCOMING-MESSAGE', 'TRIAL-BOOKED', 'TRIAL-CANCELED', 'SUBSCRIBED', 'UN-SUBSCRIBED', 'POST-COMMENT', 'POST-LIKE', 'ADD-REVIEW', 'FOLLOW', 'UN-FOLLOW', 'POST-SHARE', 'REEL-LIKE', 'REEL-COMMENT', 'ALBUM-LIKE', 'ALBUM-COMMENT', 'ALBUM-ATTACHMENT-LIKE', 'ALBUM-ATTACHMENT-COMMENT', 'REVIEW-LIKE', 'REVIEW-COMMENT', 'ORDER-PLACED']

const notificationMediumTypes = {
    mail: 'Mail',
    flash: 'FLASH',
    mobile: 'MOBILE',
    push: 'PUSH'
};

const callTypes = {
    VIDEO: 'VIDEO',
    VOICE: 'VOICE',
};

const availabilityRuleTypes = {
    wday: 'wday',
    date: 'date',
};

const feesChangeRequestTypes = {
    PENDING: 'PENDING',
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
};

const subscriptionStatusTypes = {
    'ON-GOING': 'ON-GOING',
    'EXPIRED': 'EXPIRED',
    'PENDING': 'PENDING',
};


const orderTypes = {
    PLACED: "PLACED",                     // User placed order
    CONFIRMED: "CONFIRMED",               // Payment confirmed
    PROCESSING: "PROCESSING",             // Seller preparing the order (packing, printing label)
    AWAITING_SHIPMENT: "AWAITING_SHIPMENT", // Order ready but waiting for pickup by carrier
    SHIPPED: "SHIPPED",                   // Handed over to carrier
    OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY", // Carrier out to deliver
    DELIVERED: "DELIVERED",               // Delivered to customer
    FAILED_DELIVERY: "FAILED_DELIVERY",   // Carrier attempted but failed to deliver
    RETURN_REQUESTED: "RETURN_REQUESTED", // Customer requested return
    RETURNED: "RETURNED",                 // Product returned successfully
    REFUNDED: "REFUNDED",                 // Refund issued
    CANCELLED: "CANCELLED",               // Order cancelled
};


const questionTypes = {
    TEXT: "TEXT",
    PARAGRAPH: "PARAGRAPH",
    MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
    CHECKBOX: "CHECKBOX",
    DROPDOWN: "DROPDOWN",
    LINEAR_SCALE: "LINEAR_SCALE",
    DATE: "DATE",
    TIME: "TIME",
    FILE_UPLOAD: "FILE_UPLOAD",
};

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const actionTypes = {
    appointmentBooked: 'APPOINTMENT-BOOKED',
    postAdd: 'POST-ADD',
    postComment: 'POST-COMMENT',
    postLike: 'POST-LIKE',
    postShare: 'POST-SHARE',

    addReview: 'ADD-REVIEW',
    follow: 'FOLLOW',
    unfollow: 'UN-FOLLOW',

    reelAdd: 'REEL-ADD',
    reelLike: 'REEL-LIKE',
    reelComment: 'REEL-COMMENT',

    albumLike: 'ALBUM-LIKE',
    albumComment: 'ALBUM-COMMENT',
    albumAttachmentLike: 'ALBUM-ATTACHMENT-LIKE',
    albumAttachmentComment: 'ALBUM-ATTACHMENT-COMMENT',

    productPurchased: 'PRODUCT-PURCHASED',
}

const actionTypesArr = ['APPOINTMENT-BOOKED', 'POST-ADD', 'POST-COMMENT', 'POST-LIKE', 'POST-SHARE', 'ADD-REVIEW', 'FOLLOW', 'UN-FOLLOW', 'REEL-ADD', 'REEL-LIKE', 'REEL-COMMENT', 'ALBUM-LIKE', 'ALBUM-COMMENT', 'ALBUM-ATTACHMENT-LIKE', 'ALBUM-ATTACHMENT-COMMENT', 'REVIEW-LIKE', 'REVIEW-COMMENT', 'PRODUCT-PURCHASED']


module.exports = {
    userStatusTypes,
    paymentModeTypes,
    otpTypes,
    paymentStatusTypes,
    rolesTypes,
    bookingTypes,
    tokenTypes,
    currancyTypes,
    currancyTypesArr,
    caseTypes,
    appointmentTypes,
    callTypes,
    availabilityRuleTypes,
    daysOfWeek,
    notificationTypes,
    notificationMediumTypes,
    feesChangeRequestTypes,
    subscriptionStatusTypes,
    notificationTypesArr,
    orderTypes,
    questionTypes,

    actionTypesArr,
    actionTypes,
};

