const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const app = express();
const cors = require("cors");
const Post = require("../src/models/posts/index.js");
const User = require("../src/models/user/index.js");
const admin = require("firebase-admin");
const Comment = require("./models/comments/index.js");
const Follower = require("./models/followers/index.js");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const AWS = require("aws-sdk");
const fileUpload = require("express-fileupload");
dotenv.config();

const privateKey = fs.readFileSync(
  path.resolve(__dirname, "./server.key"),
  "utf8"
);
const certificate = fs.readFileSync(
  path.resolve(__dirname, "./server.crt"),
  "utf8"
);

var credentials = { key: privateKey, cert: certificate };
var serviceAccount = require("../firebase-admin.json");
const { resolveSoa } = require("dns");
const accessKey = process.env.AWS_ACCESS_KEY;
const secretKey = process.env.AWS_SECRET_KEY;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

AWS.config.update({
  credentials: {
    secretAccessKey: secretKey,
    accessKeyId: accessKey,
  },
  region: "ap-south-1",
});

const s3 = new AWS.S3();

const decodeToken = async (req, res, next) => {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const idToken = req.headers.authorization.split("Bearer ")[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req["currentUser"] = decodedToken;
    } catch (err) {
      console.log(err);
    }
  }
  next();
};

app.use(decodeToken);

app.use(express.json());

app.use(cors());
app.use(fileUpload());

app.get("/", async (req, res) => {
  const posts = await Post.find({}, null, { sort: { hits: -1 } });
  res.status(200).json(posts);
});

app.post("/post/delete", async (req, res) => {
  const user = req["currentUser"];
  if (!user) {
    return res.status(403).send("User Must be Logged in");
  }
  const post = await Post.findOne({_id: req.body.id});
  if (post.author !== req.body.uid) {
    return res.sendStatus(403);
  }
  await Post.deleteOne({ _id: req.body.id });
  return res.sendStatus(200);
});

app.post("/post/update", async (req, res) => {
  const user = req["currentUser"];
  if (!user) {
    return res.status(403).send("User Must be Logged in");
  }
  const post = await Post.findOne({ _id: req.body.id });
  if (post.author !== req.body.uid) {
    return res.sendStatus(403);
  }
  await Post.findOneAndUpdate(
    { _id: req.body.id },
    { title: req.body.title, content: req.body.content }
  );
  return res.sendStatus(200);
});

app.post("/user/update", async (req, res) => {
  const user = req["currentUser"];
  if (!user) {
    return res.status(403).send("User Must be Logged in");
  }
  await User.findOneAndUpdate({ _id: req.body.id }, { bio: req.body.bio });
  res.sendStatus(200);
});
// fetching user id and its post
app.get("/user/:id", async (req, res) => {
  const user = await User.findOne({ _id: req.params.id });
  const userPosts = await Post.find({ author: req.params.id }, null, {
    sort: { hits: -1 },
  });
  res.status(200).json({ user, userPosts });
});
//comments
app.post("/post/:id/addComment", async (req, res) => {
  const user = req["currentUser"];
  if (!user) {
    return res.status(403).send("User Must be Logged in");
  }
  const newComment = new Comment({
    comment: req.body.comment,
    postID: req.params.id,
    user: req.body.user.uid,
    date: req.body.date,
  });
  await newComment.save();
  res.status(200).send("Working");
});
//fetching comments by post id
app.post("/checkFollower", async (req, res) => {
  const check = await Follower.exists({
    user: req.body.user.uid,
    receiver: req.body.receiver,
  });
  if (check) {
    return res.status(400).send("Already There");
  } else {
    return res.send(true);
  }
});
//follower
app.get("/post/:id/getComments", async (req, res) => {
  const postID = req.params.id;
  const comments = await Comment.find({ postID: postID });
  res.status(200).json(comments);
});
//fetching comments
app.get("/post/:id", async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id });
  await Post.findOneAndUpdate({ _id: req.params.id }, { $inc: { hits: 1 } });
  res.status(200).json(post);
});
//post update
app.post("/addFollower", async (req, res) => {
  const user = req["currentUser"];
  if (!user) {
    return res.status(403).send("User Must be Logged In");
  }
  const follower = new Follower({
    date: req.body.date,
    user: req.body.user.uid,
    receiver: req.body.receiver,
  });
  await follower.save();
  User.findOneAndUpdate({ _id: req.body.receiver }, { $inc: { followers: 1 } });
});
//post add
app.post("/addPost", async (req, res) => {
  console.log(req);
  const user = req["currentUser"];
  if (!user) {
    return res.status(403).send("User Must be Logged In");
  }
  const fileContent = Buffer.from(req.files.cover.data, "binary");
  const params = {
    Bucket: "tnp-bucket",
    Key: `blog/${req.body.author}${req.body.title}cover.jpg`,
    Body: fileContent,
  };
  const info = await s3
    .upload(params, (err) => {
      if (err) {
        console.log(err);
      }
    })
    .promise();
  const post = new Post({
    title: req.body.title,
    content: req.body.content,
    date: req.body.date,
    cover: info.Location,
    author: req.body.author,
    hits: 1,
    categories: req.body.categories,
  });
  await post.save();
  res.send("done");
});
//bucket 
app.post("/addUser", async (req, res) => {
  const fileContent = Buffer.from(req.files.profilePicture.data, "binary");
  const params = {
    Bucket: "tnp-bucket",
    Key: `blog/${req.body._id}profilePicture.jpg`,
    Body: fileContent,
  };
  const info = await s3
    .upload(params, (err) => {
      if (err) {
        console.log(err);
      }
    })
    .promise();
  const newUser = new User({
    _id: req.body._id,
    name: req.body.name,
    age: req.body.age,
    email: req.body.email,
    phoneNo: req.body.phoneNo,
    gender: req.body.gender,
    photoURL: info.Location,
    bio: req.body.bio,
  });
  await newUser.save();
  res.send("done");
});

app.get("/search/:query", async (req, res) => {
  const data = await Post.find({
    title: {
      $regex: req.params.query,
      $options: "i",
    },
  }).exec();
  res.json(data);
});

mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: true,
});
var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);
httpServer.listen(8080);
httpsServer.listen(8443);
//mongodb connection and server port