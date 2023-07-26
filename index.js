const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

//JWT verify
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      res.status(403).send({ message: "403 Forbidden" });
    }
    req.decoded = decoded;
  });
  next();
};

app.get("/", (req, res) => {
  res.send("summer camp server is running");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8fpfgcv.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  const usersCollection = client.db("summer-camp").collection("users");

  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    //jwt user token
    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
        expiresIn: "20d",
      });
      res.send({ accessToken: token });
    });

    // user add to db
    app.get("/users", verifyJWT, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;

      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exists" });
      }

      const result = await usersCollection.insertOne(user);
      console.log(result);
      res.send(result);
    });

    app.get("/admin", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = {
        email: email,
      };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });

    app.get("/instructor", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = {
        email: email,
      };
      const user = await usersCollection.findOne(query);
      res.send({ isInstructor: user?.role === "instructor" });
    });

    app.get("/student", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = {
        email: email,
      };
      const user = await usersCollection.findOne(query);
      res.send({ isStudent: user?.role === "student" });
    });

    app.put("/users/role/:userId", verifyJWT, async (req, res) => {
      try {
        const { userId } = req.params;
        const { role } = req.body;

        // Make sure the role is valid (e.g., "admin" or "instructor")
        if (role !== "admin" && role !== "instructor") {
          return res.status(400).json({ message: "Invalid role value" });
        }

        console.log("Received userId:", userId);
        console.log("Received role:", role);

        const query = { _id: new ObjectId(userId) };
        const update = { $set: { role } };

        // console.log("Update query:", query);
        // console.log("Update data:", update);

        const result = await usersCollection.updateOne(query, update);

        // console.log("Update result:", result);

        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .json({ message: "User not found or no changes made" });
        }

        res.json({ message: "User role updated successfully" });
      } catch (error) {
        console.error("Error updating user role:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});
