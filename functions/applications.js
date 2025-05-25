const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const https = require("https");
const app = express();
app.use(cors({origin: true}));

const db = admin.firestore();

// read all
app.get("/applications", (req, res) => {
  cors()(req, res, () => {
    (async () => {
      try {
        const querySnapshot = await db.collection("applications").get();
        const selectedStops = querySnapshot.docs.map((doc) => doc.data());
        return res.status(200).send(selectedStops);
      } catch (error) {
        console.log(error);
        return res.status(500).send(error);
      }
    })();
  });
});

app.get("/applications/initialLoad", (req, res) => {
  console.log("on demand job to load initial values of applications");
  let data = "";
  const options = {
    hostname: "newconfigs.transitappliance.com",
    port: 443,
    path: "/applications.json",
    method: "GET",
  };
  const request = https.request(options, (response) => {
    response.on("data", (d) => {
      data += d;
    });
    response.on("close", async () => {
      console.log("Response closed");
      const applications = JSON.parse(data);
      const rows = applications.rows;
      const batch = db.batch();
      rows.forEach(function(key) {
        const val = key.key;
        const docRef = db.collection("applications").doc(val._id);
        batch.set(docRef, val);
      });
      await batch.commit().then(function(response) {
        console.log("batch write success");
      }).catch(function(error) {
        console.log("batch write error on batch "+error);
      });
    });
  });
  request.end();
  return res.status(200).send("request completed");
});

exports.applications = functions.region("us-central1").https.onRequest(app);
