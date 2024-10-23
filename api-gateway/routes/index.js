const express = require("express");
const axios = require("axios");
const router = express.Router();
const registry = require("./registry.json");
const fs = require("fs");
const loadbalancer = require("../util/loadbalancer");

router.post("/enable/:apiName", (req, res) => {
  const apiName = req.params.apiName;
  const requestBody = req.body;
  const instances = registry.services[apiName].instances;
  const index = instances.findIndex((srv) => {
    return srv.url === requestBody.url;
  });
  if (index === -1) {
    res.send({
      status: "error",
      message: `Could not find ${requestBody.url} for service ${apiName}`,
    });
  } else {
    instances[index].enabled = requestBody.enabled;
    fs.writeFile(
      "./routes/registry.json",
      JSON.stringify(registry),
      (error) => {
        if (error) {
          res.send(
            `couldn't enable/disable ${requestBody.url} for ${apiName} :` +
              error
          );
        } else {
          res.send(
            `successfully enabled/disabled ${requestBody.url} for service ${apiName}`
          );
        }
      }
    );
  }
});

router.all("/:apiName/:path", async (req, res) => {
  const service = registry.services[req.params.apiName];
  if (service) {
    try {
      if (!service.loadBalanceStrategy) {
        service.loadBalanceStrategy = "ROUND_ROBIN";
        fs.writeFile(
          "./routes/registry.json",
          JSON.stringify(registry),
          (error) => {
            if (error) {
              res.send("couldn't write load balancer strategy" + error);
            } else {
              res.send("successfully written load balancer strategy");
            }
          }
        );
      }
      const newIndex = loadbalancer[service.loadBalanceStrategy](service);
      const url = service.instances[newIndex].url;
      console.log(url);
      const response = await axios({
        method: req.method,
        url: `${url}/${req.params.path}`,
        headers: req.headers,
        data: req.body,
      });
      res.send(response.data);
    } catch (error) {
      console.error("Error forwarding request:", error.message);
      res.status(500).send("Internal server error");
    }
  } else {
    res.status(404).send("API name doesn't exist");
  }
});

router.post("/register", (req, res) => {
  const registrationInfo = req.body;

  registrationInfo.url =
    registrationInfo.protocol +
    "://" +
    registrationInfo.host +
    ":" +
    registrationInfo.port;

  if (apiAlreadyExists(registrationInfo)) {
    return res.send(
      "Configuration already exists for" +
        " " +
        registrationInfo.apiName +
        " " +
        "at" +
        " " +
        registrationInfo.url
    );
  }

  registry.services[registrationInfo.apiName].instances.push({
    ...registrationInfo,
  });

  fs.writeFile("./routes/registry.json", JSON.stringify(registry), (error) => {
    if (error) {
      res.send(
        "could not register" + " " + registrationInfo.apiName + "\n" + error
      );
      console.log(error);
    } else {
      res.send("successfully registered" + " " + registrationInfo.apiName);
    }
  });
});

router.post("/unregister", (req, res) => {
  const registrationInfo = req.body;
  if (!apiAlreadyExists(registrationInfo)) {
    return res.send(
      "Configuration does not exist for" +
        " " +
        registrationInfo.apiName +
        " " +
        "at" +
        " " +
        registrationInfo.url
    );
  }

  const index = registry.services[registrationInfo.apiName].instances.findIndex(
    (instance) => {
      return instance.url === registrationInfo.url;
    }
  );

  registry.services[registrationInfo.apiName].instances.splice(index, 1);

  fs.writeFile("./routes/registry.json", JSON.stringify(registry), (error) => {
    if (error) {
      res.send(
        "could not unregister" + " " + registrationInfo.apiName + "\n" + error
      );
      console.log(error);
    } else {
      res.send("successfully unregistered" + " " + registrationInfo.apiName);
    }
  });
});

const apiAlreadyExists = (registrationInfo) => {
  let exists = false;
  registry.services[registrationInfo.apiName].instances.forEach((element) => {
    if (element.url === registrationInfo.url) {
      exists = true;
    }
  });

  return exists;
};

module.exports = router;
