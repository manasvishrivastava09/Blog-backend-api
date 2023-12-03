const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    _id: String,
    name: String,
    age: Number,
    email: String,
    phoneNo: Number,
    gender: String,
    photoURL: String,
    bio: String,
    followers: Number,
});

const User = mongoose.model("Users", userSchema);

module.exports = User;