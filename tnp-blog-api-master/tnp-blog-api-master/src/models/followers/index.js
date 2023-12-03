const mongoose = require("mongoose");

const followerSchema = new mongoose.Schema({
    receiver: String,
    user: String,
    date: String,
});

const Follower = mongoose.model("Follower", followerSchema);

module.exports = Follower;