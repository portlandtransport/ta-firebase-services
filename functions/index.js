const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const https = require("https");
const app = express();
app.use(cors({origin: true}));

const firebaseConfig = require("./config.json");
const serviceAccount = require("./serviceAccount.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: firebaseConfig.databaseURL,
});
const db = admin.firestore();

/**
 * remap individual URL to https
 * @param {string} url individual url
 * @return {string} modified url
 */
function remapUrlToHttps(url) {
  let newUrl = url.replace("http://dev.transiboard.com", "https://dev.transitboard.com");
  newUrl = newUrl.replace("http://transitboard.com", "https://transitboard.com");
  return newUrl;
}

/**
 * remap URL structure to https
 * @param {object} configurations url structure
 * @return {object} modified url structure
 */
function remapConfigUrlsToHttps(configurations) {
  const newConfig = {};
  newConfig.url = remapUrlToHttps(configurations.url);
  newConfig.urls = [];
  configurations.urls.forEach(function(element) {
    const newElement = {};
    if (element.app_url) {
      newElement.app_url = remapUrlToHttps(element.app_url);
    }
    if (element.img_url) {
      newElement.img_url = remapUrlToHttps(element.img_url);
    }
    newConfig.urls.push(newElement);
  });
  return newConfig;
}

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
      return res.status(200).jsonp(selectedStops);
    } catch (error) {
      console.log(error);
      return res.status(500).send(error);
    }
  })();
});

exports.stops = functions.https.onRequest(app);

/*
exports.addMessage = functions.https.onRequest((req, res) => {
  cors()(req, res, () => {
    return res.json({status: 'ok'});
  });
});
*/

exports.scheduledFunctionCrontab = functions.pubsub.schedule("10 12 * * *")
    .timeZone("America/Los_Angeles")
    .onRun((context) => {
      console.log("scheduled job to update TriMet entries");
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
                // console.log("updated stop "+key);
              } catch (error) {
                console.log("error updating stop "+key+": "+error);
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
                  console.log("updated stop "+key);
                } catch (error) {
                  console.log("error updating stop "+key+": "+error);
                }
              })();
            });
          }, 5000);
        });
      });
      request.end();
      return null;
    });

// configuration functions

const configs = express();
configs.use(cors({origin: true}));

// read config
configs.get("/configuration/:item_id", (req, res) => {
  cors()(req, res, () => {
    (async function() {
      try {
        const document = db.collection("configs").doc(req.params.item_id);
        const item = await document.get();
        if (item.exists) {
          const response = item.data();
          if ({}.hasOwnProperty.call(response, "value")) {
            const value = response["value"];
            if ({}.hasOwnProperty.call(value, "external_configuration")) {
              return res.status(200).
                  send(remapConfigUrlsToHttps(value.external_configuration));
            } else {
              return res.status(404)
                  .send({"error": "No matching configuration found",
                    "source": "firestore"});
            }
          } else {
            return res.status(404)
                .send({"error": "No matching configuration found",
                  "source": "firestore"});
          }
        } else {
          return res.status(404)
              .send({"error": "No matching configuration found",
                "source": "firestore"});
        }
      } catch (error) {
        console.log(error);
        return res.status(500).send(error);
      }
    })();
  });
});

configs.get("/configs/copyAll", (req, res) => {
  let data = "";
  const options = {
    hostname: "68d011c8-fd22-4ad8-8471-c8b4d1729f90-bluemix.cloudant.com",
    port: 443,
    path: "/ta_config_production/_design/ta_config_production/_view/all",
    method: "GET",
  };
  const request = https.request(options, (response) => {
    response.on("data", (d) => {
      data += d;
    });
    response.on("end", () => {
      console.log("Response ended");
      const raw = JSON.parse(data);
      const configurations = raw.rows;
      for (const val of configurations) {
        (async () => {
          try {
            await db.collection("configs").doc(val.id).set(val);
            // console.log("updated config "+val.id);
          } catch (error) {
            console.log("error updating config "+val.id);
          }
        })();
      }
      return res.status(200).send("wrote configurations");
    });
  });
  request.on("error", (e) => {
    console.error(e.message);
  });
  request.end();
  return null;
});

exports.configs = functions.https.onRequest(configs);
