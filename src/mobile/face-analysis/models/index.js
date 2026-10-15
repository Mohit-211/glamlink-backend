// The mobile/face-analysis module's tables.
const FaceAnalysis = require('./faceAnalysis.model');
const FaceAnalysisQnA = require('./faceAnalysisQnA.model');

const associate = () => {};

module.exports = { models: { FaceAnalysis, FaceAnalysisQnA }, associate };
