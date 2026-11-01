import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { adminAuth } from "@/lib/firebase-admin";

export const runtime = "nodejs";

cloudinary.config({
cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
api_key: process.env.CLOUDINARY_API_KEY,
api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
try {
const authorization = request.headers.get("authorization");


if (!authorization?.startsWith("Bearer ")) {
  return NextResponse.json(
    { error: "Authentication required." },
    { status: 401 }
  );
}

const token = authorization.substring(7);
const decodedToken = await adminAuth.verifyIdToken(token);

if (decodedToken.uid !== "MiCPapmVpcggbMozz8eV45jI7pX2") {
  return NextResponse.json(
    { error: "Admin access required." },
    { status: 403 }
  );
}

const formData = await request.formData();
const file = formData.get("image");

if (!(file instanceof File)) {
  return NextResponse.json(
    { error: "Please select an image." },
    { status: 400 }
  );
}

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

if (!allowedTypes.includes(file.type)) {
  return NextResponse.json(
    { error: "Only JPG, PNG, WEBP and AVIF images are allowed." },
    { status: 400 }
  );
}

if (file.size > 5 * 1024 * 1024) {
  return NextResponse.json(
    { error: "Image size must be under 5 MB." },
    { status: 400 }
  );
}

const bytes = await file.arrayBuffer();
const buffer = Buffer.from(bytes);

const result = await new Promise<any>((resolve, reject) => {
  cloudinary.uploader.upload_stream(
    {
      folder: "gadget-store/products",
      resource_type: "image",
    },
    (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    }
  ).end(buffer);
});

return NextResponse.json({
  success: true,
  imageUrl: result.secure_url,
  publicId: result.public_id,
  message: "Image uploaded successfully!",
});


} catch (error) {
console.error("Image upload error:", error);


return NextResponse.json(
  { error: "Image upload failed. Please try again." },
  { status: 500 }
);


}
}
