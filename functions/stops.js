const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const https = require("https");
const app = express();
app.use(cors({origin: true}));

// const firebaseConfig = require("./config.json");
// const serviceAccount = require("./serviceAccount.json");
// admin.initializeApp({
//  credential: admin.credential.cert(serviceAccount),
//  databaseURL: firebaseConfig.databaseURL,
// });
const db = admin.firestore();

// read stop
app.get("/stop/:item_id", (req, res) => {
  cors()(req, res, () => {
    (async function() {
      try {
        const document = db.collection("stops").doc(req.params.item_id);
        const item = await document.get();
        if (item.exists) {
          const response = item.data();
          return res.status(200).send(response);
        } else {
          return res.status(404).send(req.params.item_id+" not found");
        }
      } catch (error) {
        console.log(error);
        return res.status(500).send(error);
      }
    })();
  });
});

app.options("/stop/:item_id", (req, res) => {
  // unclear if this actually necessary,
  // these may qualify as requests that don't need CORS
  // works over http, but gets 502 error on https
  cors()(req, res, () => {
    return res.status(200).send({msg: "This is CORS-enabled for all origins!"});
  });
});

// read all
app.get("/stops", (req, res) => {
  (async () => {
    try {
      const querySnapshot = await db.collection("stops").get();
      const selectedStops = querySnapshot.docs.map((doc) => doc.data());
      return res.status(200).send(selectedStops);
    } catch (error) {
      console.log(error);
      return res.status(500).send(error);
    }
  })();
});

app.get("/stops/agency/:agency_id", (req, res) => {
  (async () => {
    try {
      const querySnapshot =
        await db.collection("stops").where(
            "agency", "==", req.params.agency_id,
        ).get();
      const selectedStops = querySnapshot.docs.map((doc) => doc.data());
      return res.status(200).send(selectedStops);
    } catch (error) {
      console.log(error);
      return res.status(500).send(error);
    }
  })();
});

app.get("/stops/byLng", (req, res) => {
  // ?startkey=-122.66459740163576&endkey=-122.65172279836428
  // &callback=jsonp1636221434112
  // return res.status(200).jsonp([req.query.startkey, req.query.endkey]);
  (async () => {
    try {
      const querySnapshot =
        await db.collection("stops").where(
            "stop_lon", ">=", parseFloat(req.query.startkey),
        ).where(
            "stop_lon", "<=", parseFloat(req.query.endkey),
        ).get();
      const selectedStops = querySnapshot.docs.map((doc) => doc.data());
      return res.status(200).jsonp({"rows": selectedStops});
    } catch (error) {
      console.log(error);
      return res.status(500).send(error);
    }
  })();
});

app.get("/stops/saveUpdates", (req, res) => {
  (async () => {
    console.log("on demand job to update TriMet entries");
    let data = "";
    const options = {
      hostname: "transitboard.com",
      port: 443,
      path: "/firebase_stop_updates.json",
      method: "GET",
    };
    const request = https.request(options, (response) => {
      response.on("data", (d) => {
        data += d;
      });
      response.on("close", () => {
        console.log("Response closed");
        const stops = JSON.parse(data);
        Object.keys(stops.stops).forEach(function(key) {
          const val = stops.stops[key];
          (async () => {
            try {
              await db.collection("stops").doc(key).set(val);
              console.log("first pass updated stop "+key);
            } catch (error) {
              console.log("first pass error updating stop "+key+": "+error);
            }
          })();
        });
        setTimeout(function() {
          // wait a few seconds and do it again to deal
          // with coldstart timeouts
          Object.keys(stops.stops).forEach(function(key) {
            const val = stops.stops[key];
            (async () => {
              try {
                await db.collection("stops").doc(key).set(val);
                console.log("2nd pass updated stop "+key);
              } catch (error) {
                console.log("2nd pass error updating stop "+key+": "+error);
              }
            })();
          });
        }, 5000);
      });
    });
    request.end();
    return res.status(200).send("request completed");
  })();
});

exports.stops = functions.https.onRequest(app);
