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
  const classesCollection = client.db("summer-camp").collection("classes");
  const bookClassCollection = client.db("summer-camp").collection("book-class");

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

    // classes add to db
    app.get("/classes", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    app.post("/classes", async (req, res) => {
      const classes = req.body;

      const result = await classesCollection.insertOne(classes);
      console.log(result);
      res.send(result);
    });

    app.get("/classes/:id", async (req, res) => {
      const classId = req.params.id;

      try {
        const classDetails = await classesCollection.findOne({
          _id: new ObjectId(classId),
        });

        if (!classDetails) {
          return res.status(404).json({ error: "Class not found" });
        }

        res.json(classDetails);
      } catch (error) {
        console.error("Error retrieving class details:", error);
        res.status(500).json({ error: "Failed to retrieve class details" });
      }
    });

    app.get("/single-class", async (req, res) => {
      try {
        const { email } = req.query;
        console.log(email);

        // MongoDB collection named "classesCollection"
        const query = {
          instructorEmail: email,
        };
        console.log(query);

        const result = await classesCollection.find(query).toArray();
        res.json(result);
      } catch (error) {
        console.error("Error fetching classes by email:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.put("/classes/:classId", verifyJWT, async (req, res) => {
      try {
        const { classId } = req.params;
        const { feedback } = req.body;

        const query = { _id: new ObjectId(classId) };
        const update = { $push: { feedback: feedback } };

        const result = await classesCollection.updateOne(query, update);
        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .json({ message: "feedback not found or no changes made" });
        }

        res.json({ message: "feedback updated successfully" });
      } catch (error) {
        console.error("Error updating feedback:", error);
        res.status(500).json({ error: "Internal server error" });
      }
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

    // instructor
    app.get("/users/role", async (req, res) => {
      const { role } = req.query;

      const query = role ? { role } : {};

      try {
        const result = await usersCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.put("/users/role/:userId", verifyJWT, async (req, res) => {
      try {
        const { userId } = req.params;
        const { role } = req.body;

        // "admin" or "instructor")
        if (role !== "admin" && role !== "instructor") {
          return res.status(400).json({ message: "Invalid role value" });
        }

        console.log("Received userId:", userId);
        console.log("Received role:", role);

        const query = { _id: new ObjectId(userId) };
        const update = { $set: { role } };

        const result = await usersCollection.updateOne(query, update);

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

    //status
    app.put("/status/:userId", verifyJWT, async (req, res) => {
      try {
        const { userId } = req.params;
        const { status } = req.body;
        const query = { _id: new ObjectId(userId) };
        const update = { $set: { status } };
        const result = await classesCollection.updateOne(query, update);
        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .json({ message: "status found or no changes made" });
        }
        res.json({ message: "status updated successfully" });
      } catch (error) {
        console.error("Error updating status:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    //book class from student
    app.post("/book-class", async (req, res) => {
      try {
        const booking = req.body;

        const existingBooking = await bookClassCollection.findOne({
          studentEmail: booking.studentEmail,
          classId: booking.classId,
        });

        if (existingBooking) {
          return res
            .status(400)
            .json({ message: "You have already booked this class." });
        }

        const classResult = await classesCollection.updateOne(
          { _id: new ObjectId(booking.classId) },
          { $inc: { enrolledStudent: 1 } }
        );

        if (classResult.modifiedCount === 0) {
          return res
            .status(404)
            .json({ message: "Class not found or no changes made." });
        }

        const bookingResult = await bookClassCollection.insertOne(booking);

        const bookingUpdateResult = await bookClassCollection.updateOne(
          { _id: bookingResult.insertedId },
          { $inc: { enrolledStudent: 1 } }
        );

        if (bookingUpdateResult.modifiedCount === 0) {
          return res
            .status(500)
            .json({ error: "Failed to update booking information." });
        }

        res.json({ message: "Class booked successfully", data: bookingResult });
      } catch (error) {
        console.error("Error booking class:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.get("/book-class", async (req, res) => {
      const email = req.query.email;
      const query = {
        studentEmail: email,
      };
      const result = await bookClassCollection.find(query).toArray();
      res.send(result);
    });
    // delete class from student book class
    app.delete("/delete-class/:id", async (req, res) => {
      const deleteId = req.params.id;
      const query = {
        _id: new ObjectId(deleteId),
      };
      const result = await bookClassCollection.deleteOne(query);
      res.send(result);
    });

    //top enroll
    app.get("/top-enroll-class", async (req, res) => {
      const query = {};
      const result = await classesCollection
        .find()
        .sort({ enrolledStudent: -1 })
        .limit(6)
        .toArray();
      res.send(result);
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
