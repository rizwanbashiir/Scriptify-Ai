import { OAuth2Client } from "google-auth-library";
import User from "../../models/user/users.js";
import bcrypt from "bcrypt";
import { generateAccessToken, generateRefreshToken } from "./userController.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleSignIn = async (req, res, next) => {
  console.log("on line 8");
  try {
    console.log("on line 11");
    const { credential } = req.body;
    console.log("credential", credential);
    if (!credential) {
      return res.status(400).json({ message: "Google credential token is required" });
    }
    console.log("on line 17")
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (error) {
      console.error("Google Token Verification Error:", error.message);
      return res.status(401).json({ message: "Invalid Google token", error: error.message });
    }

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ message: "Invalid Google token payload" });
    }

    const { sub, email, name, picture, given_name, family_name } = payload;

    if (!email) {
      return res.status(400).json({ message: "Email is missing from Google profile" });
    }

    let user = await User.findOne({ email }).select("+password +refreshToken");

    if (!user) {
      // User does not exist, create new user
      user = await User.create({
        firstName: given_name || name || "User",
        lastName: family_name || "",
        email,
        googleId: sub,
        authProvider: "google",
        isVerified: true,
        avatar: picture,
        role: "reader", // default role
      });
    } else {
      // User exists
      if (user.isSuspended) {
        return res.status(403).json({ message: "Your account has been suspended. Contact support." });
      }

      // Update missing Google info if needed
      let updated = false;
      if (!user.googleId) {
        user.googleId = sub;
        user.authProvider = "google";
        user.isVerified = true;
        updated = true;
      }
      if (!user.avatar && picture) {
        user.avatar = picture;
        updated = true;
      }
      if (updated) {
        await user.save();
      }
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = await bcrypt.hash(refreshToken, 10);
    await user.save();

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};
