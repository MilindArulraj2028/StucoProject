
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

initializeApp();

const adminRegistrationCode = defineSecret("ADMIN_REGISTRATION_CODE");

exports.registerAdmin = onCall(
  { secrets: [adminRegistrationCode] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    const submittedCode = request.data?.code;

    if (
      typeof submittedCode !== "string" ||
      submittedCode !== adminRegistrationCode.value()
    ) {
      throw new HttpsError("permission-denied", "Incorrect admin code.");
    }

    const user = await getAuth().getUser(request.auth.uid);

    await getAuth().setCustomUserClaims(request.auth.uid, {
      ...user.customClaims,
      admin: true,
    });

    return { success: true };
  }
);
