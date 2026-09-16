const { Schema, model, Types } = require("mongoose");

const userSchema = new Schema(
  {
    username: { type: String, required: true, trim: true, minlength: 3, maxlength: 30, unique: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin", "dev"], default: "user", index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: String(this._id),
    username: this.username,
    email: this.email,
    role: this.role,
    createdAt: this.createdAt,
  };
};

module.exports = model("User", userSchema);
