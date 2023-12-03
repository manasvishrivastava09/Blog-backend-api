const mongoose = require("mongoose");

const commentsSchema = new mongoose.Schema({
    postID: String,
    user: String,
    comment: String,
    date: String,
});

const Comments = mongoose.model("Comments", commentsSchema);

module.exports = Comments