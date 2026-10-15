const httpStatus = require("../../core/http/status");
const { User, ServiceAttachment, FaceAnalysis, FaceAnalysisQnA } = require("../../models");
const ApiError = require("../../core/http/ApiError");
const faceppApi = require("../../integrations/facepp");
const openaiService = require("../../integrations/openai");

const analyzeSkin = async (body, files) => {
  const { user, face_analysis_id, question } = body;

  // 🧠 Case 1: Follow-up question
  if (face_analysis_id && question && (!files || !files.images)) {
    const analysis = await FaceAnalysis.findOne({
      where: { id: face_analysis_id, user_id: user.id },
    });
    if (!analysis)
      throw new ApiError(httpStatus.NOT_FOUND, "Face analysis not found");

    const answer = await openaiService.askAIQuestion(
      analysis.summary,
      question,
    );
    const record = await FaceAnalysisQnA.create({
      face_analysis_id,
      user_id: user.id,
      question,
      answer,
    });

    return { type: "follow_up", message: "Follow-up answered.", data: record };
  }

  // 🧩 Case 2: New Image Analysis
  if (!files || !files.images)
    throw new ApiError(httpStatus.BAD_REQUEST, "Image is required");

  const userDoc = await User.findOne({ where: { id: user.id } });
  if (!userDoc) throw new ApiError(httpStatus.NOT_FOUND, "User not found");

  // Step 1: Analyze skin using Face++
  const skinAnalysis = await faceppApi.analyzeSkin(files.images[0].path);
  if (!skinAnalysis)
    throw new ApiError(httpStatus.BAD_REQUEST, "Skin analysis failed");

  console.log(skinAnalysis, "skinAnalysis");

  // Step 2: Generate human summary
  const summary = await openaiService.getAISkinExplanation(skinAnalysis.result);

  console.log(summary, "summary");

  // Step 3: Fetch professionals + services
  const professionals = await User.findAll({
    where: { role_id: 7, is_active: true },
    include: [
      { association: "user_profile" },
      {
        association: "all_service",
        include: [
          {
            model: ServiceAttachment,
            as: "attachements",
            attributes: ["id", "file_type", "file_name", "file_uri"],
          },
        ],
      },
    ],
  });

  // 💡 Clean data before sending to AI
  const cleanProfessionals = professionals.map((b) => ({
    id: b.id,
    name: b.user_profile?.name || b.user_name,
    about: b.user_profile?.about || undefined,
    email: b.email,
    booking_link: b.user_profile?.booking_link,
    services: (b.all_service || []).map((s) => ({
      id: s.id,
      name: s.name,
      price: s.price,
    })),
  }));

  // Step 4: Create personalized recommendation based on summary + services
  const recommendations =
    await openaiService.getProfessionalServiceRecommendation(
      summary,
      cleanProfessionals,
    );

  console.log(recommendations, "recommendations");

  // Step 5: Save analysis
  const record = await FaceAnalysis.create({
    user_id: user.id,
    image_path: files.images[0].path,
    face_token: skinAnalysis.request_id,
    raw_response: skinAnalysis,
    summary,
    recommendations,
  });

  console.log(record, "record");

  return {
    type: "analysis",
    message: "Face analysis and service recommendations completed.",
    data: {
      ...record.toJSON(), // ensures proper JSON structure
      recommendations, // include AI recommendations
      cleanProfessionals, // include professionals fetched
    },
  };
};

module.exports = {
    analyzeSkin,
};
