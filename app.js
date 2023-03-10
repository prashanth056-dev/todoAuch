let express = require("express");
let { open } = require("sqlite");
let sqlite3 = require("sqlite3");
let path = require("path");
let bcrypt = require("bcrypt");
let jwt = require("jsonwebtoken");

let app = express();
app.use(express.json());

let fpath = path.join(__dirname, "twitterClone.db");
let db = null;

initialize = async () => {
  try {
    db = await open({ filename: fpath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("server started at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error:${e.message}`);
    process.exit(-1);
  }
};
initialize();

app.post("/register/", async (req, res) => {
  let { username, password, name, gender } = req.body;
  let query1 = `select * from user where username='${username}';`;
  let op1 = await db.get(query1);
  if (op1 !== undefined) {
    res.status(400);
    res.send("User already exists");
  } else if (password.length < 6) {
    res.status(400);
    res.send("Password is too short");
  } else {
    let hPsk = await bcrypt.hash(password, 10);
    let query = `insert into user (username,password,name,gender)
                values ('${username}','${hPsk}','${name}','${gender}');`;
    await db.run(query);
    res.send("User created successfully");
  }
});

app.post("/login/", async (req, res) => {
  let { username, password } = req.body;
  let query1 = `select * from user where username='${username}';`;
  let op1 = await db.get(query1);
  if (op1 === undefined) {
    res.status(400);
    res.send("Invalid user");
  } else {
    let hPsk = await bcrypt.compare(password, op1.password);
    if (hPsk) {
      let payload = { username: username };
      let jwtToken = jwt.sign(payload, "14581@Pn");
      res.send({ jwtToken });
    } else {
      res.status(400);
      res.send("Invalid password");
    }
  }
});

auchenticate = (req, res, nxt) => {
  let jwtToken;
  let authHead = req.headers["authorization"];
  if (authHead === undefined) {
    res.status(401);
    res.send("Invalid JWT Token");
  } else {
    jwtToken = authHead.split(" ")[1];
  }
  if (jwtToken === undefined) {
    res.status(401);
    res.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "14581@Pn", (error, payload) => {
      if (error) {
        res.status(401);
        res.send("Invalid JWT Token");
      } else {
        req.username = payload.username;
        nxt();
      }
    });
  }
};

app.get("/user/tweets/feed/", auchenticate, async (req, res) => {
  let { username } = req;
  let q1 = `select user_id from user where username='${username}';`;
  let op1 = await db.get(q1);
  let userId = op1.user_id;
  let query = `select user.username as username,
                tweet.tweet as tweet,
                tweet.date_time as dateTime 
                from user 
                inner join follower on user.user_id=follower.following_user_id 
                inner join tweet on follower.following_user_id=tweet.user_id
                where follower.follower_user_id="${userId}"
                limit 4 offset 0;`;
  let op = await db.all(query);
  res.send(op);
});

app.get("/user/following/", auchenticate, async (req, res) => {
  let { username } = req;
  let q1 = `select user_id from user where username='${username}';`;
  let op1 = await db.get(q1);
  let userId = op1.user_id;
  let query = `select user.name as name from user 
                inner join follower on 
                user.user_id=follower.following_user_id 
                where follower.follower_user_id=${userId};`;
  let op = await db.all(query);
  res.send(op);
});

app.get("/user/followers/", auchenticate, async (req, res) => {
  let { username } = req;
  let q1 = `select user_id from user where username='${username}';`;
  let op1 = await db.get(q1);
  let userId = op1.user_id;
  let query = `select user.name as name from user 
                inner join follower on 
                user.user_id=follower.follower_user_id 
                where follower.following_user_id=${userId};`;
  let op = await db.all(query);
  res.send(op);
});

app.get("/tweets/:tweetId/", auchenticate, async (req, res) => {
  let { tweetId } = req.params;
  let { username } = req;
  let q1 = `select user_id from user where username='${username}';`;
  let op1 = await db.get(q1);
  let userId = op1.user_id;
  let query = `select user.user_id as id from user 
                inner join follower on 
                user.user_id=follower.following_user_id 
                where follower.follower_user_id=${userId};`;
  let op = await db.all(query);
  let q2 = `select user_id as id from tweet where tweet_id=${tweetId};`;
  let op2 = await db.get(q2);
  let lst = [];
  for (let i of op) {
    lst.push(i.id);
  }
  if (lst.includes(op2.id) === false) {
    res.status(401);
    res.send("Invalid Request");
  } else {
    let q3 = `select tweet.tweet as tweet, 
      (select count(tweet_id)  from like where tweet_id=${tweetId} group by tweet_id) as likes,
      (select count(tweet_id)  from reply where tweet_id=${tweetId} group by tweet_id) as replies,
      tweet.date_time as dateTime 
      from tweet inner join like on tweet.tweet_id=like.tweet_id 
      inner join reply on tweet.tweet_id=reply.tweet_id 
      group by tweet having tweet.tweet_id=${tweetId} ;`;
    let op3 = await db.get(q3);
    res.send(op3);
  }
});

app.get("/tweets/:tweetId/likes/", auchenticate, async (req, res) => {
  let { tweetId } = req.params;
  let { username } = req;
  let q1 = `select user_id from user where username='${username}';`;
  let op1 = await db.get(q1);
  let userId = op1.user_id;
  let query = `select user.user_id as id from user 
                inner join follower on 
                user.user_id=follower.following_user_id 
                where follower.follower_user_id=${userId};`;
  let op = await db.all(query);
  let q2 = `select user_id as id from tweet where tweet_id=${tweetId};`;
  let op2 = await db.get(q2);
  let followingLst = [];
  for (let i of op) {
    followingLst.push(i.id);
  }
  if (followingLst.includes(op2.id) === false) {
    res.status(401);
    res.send("Invalid Request");
  } else {
    let q3 = `select distinct user.username as name from user inner join like on user.user_id=like.user_id where like.tweet_id=${tweetId};`;
    let op3 = await db.all(q3);
    let nameLst = [];
    for (let i of op3) {
      nameLst.push(i.name);
    }
    res.send({ likes: nameLst });
  }
});

app.get("/tweets/:tweetId/replies/", auchenticate, async (req, res) => {
  let { tweetId } = req.params;
  let { username } = req;
  let q1 = `select user_id from user where username='${username}';`;
  let op1 = await db.get(q1);
  let userId = op1.user_id;
  let query = `select user.user_id as id from user 
                inner join follower on 
                user.user_id=follower.following_user_id 
                where follower.follower_user_id=${userId};`;
  let op = await db.all(query);
  let q2 = `select user_id as id from tweet where tweet_id=${tweetId};`;
  let op2 = await db.get(q2);
  let followingLst = [];
  for (let i of op) {
    followingLst.push(i.id);
  }
  if (followingLst.includes(op2.id) === false) {
    res.status(401);
    res.send("Invalid Request");
  } else {
    let q3 = `select user.username as name,
    reply.reply as reply from user 
    inner join reply on user.user_id=reply.user_id 
    where reply.tweet_id=${tweetId};`;
    let op3 = await db.all(q3);
    res.send({ replies: op3 });
  }
});

app.get("/user/tweets/", auchenticate, async (req, res) => {
  let { username } = req;
  let q1 = `select user_id from user where username='${username}';`;
  let op1 = await db.get(q1);
  let userId = op1.user_id;
  let query = `select tweet,
            count(like.like_id) as likes,
            count(reply.reply_id) as replies,
            date_time as dateTime
            from tweet
            inner join like on like.user_id=tweet.user_id
            inner join reply on reply.user_id=tweet.user_id
            where tweet.user_id=${userId} 
            group by tweet;`;
  let op = await db.all(query);
  res.send(op);
});

app.post("/user/tweets/", auchenticate, async (req, res) => {
  let { tweet } = req.body;
  let { username } = req;
  let q1 = `select user_id from user where username='${username}';`;
  let op1 = await db.get(q1);
  let user_id = op1.user_id;
  let date_time = new Date();
  let query = `insert into tweet (tweet) values ('${tweet}');`;
  await db.run(query);
  res.send("Created a Tweet");
});

app.delete("/tweets/:tweetId/", auchenticate, async (req, res) => {
  let { tweetId } = req.params;
  let { username } = req;
  let q1 = `select user_id from user where username='${username}';`;
  let op1 = await db.get(q1);
  let userId = op1.user_id;
  let q2 = `select user_id as id from tweet where tweet_id=${tweetId};`;
  let op2 = await db.get(q2);
  if (userId !== op2.id) {
    res.status(401);
    res.send("Invalid Request");
  } else {
    let q3 = `delete from tweet where tweet_id=${tweetId};`;
    await db.run(q3);
    res.send("Tweet Removed");
  }
});

module.exports = app;
