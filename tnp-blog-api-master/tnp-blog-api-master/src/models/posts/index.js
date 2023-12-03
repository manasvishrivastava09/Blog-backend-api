const mongoose = require("mongoose");

const postSchema = new mongoose.Schema({
    title: String,
    content: String,
    date: String,
    author: String,
    hits: Number,
    categories: String,
    cover: String,
});

const Post = mongoose.model("Posts", postSchema);

module.exports = Post;