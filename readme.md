Here’s a complete **documentation** covering the **Gateway server** and **Fake API service**, including the core concepts, code explanations, and usage.

---

# Documentation for Gateway Server and Fake API Service

## Table of Contents

1. **Overview**
2. **Concepts**
   - API Gateway
   - Service Registry
   - Load Balancer Strategies
   - Authentication Middleware
3. **Gateway Server**
   - How it Works
   - Code Explanation
4. **Fake API Service**
   - How it Works
   - Code Explanation
5. **How to Run**
6. **API Endpoints**
7. **Example Requests and Responses**

---

## 1. Overview

The setup consists of:

1. **Gateway Server**: Acts as a reverse proxy to route requests to different backend services. It registers and manages multiple services with features like load balancing and service enabling/disabling.
2. **Fake API Service**: A mock service running on port 8000, used for testing communication with the Gateway.

---

## 2. Concepts

### **API Gateway**

An API Gateway serves as a centralized entry point for different backend services. It receives client requests, forwards them to the appropriate service, and returns the service’s response.

In this project, the gateway performs the following:

- **Routing**: Sends requests to the correct service instance.
- **Load Balancing**: Distributes requests across instances.
- **Authentication**: Ensures only valid users access the services.

---

### **Service Registry**

A **Service Registry** stores metadata about registered services. In this example, services are registered with their name, protocol, host, port, and enabled status. The registry is saved in `registry.json`.

**Example** (registry.json):

```json
{
  "services": {
    "testapi": {
      "index": 0,
      "instances": [
        {
          "apiName": "testapi",
          "protocol": "http",
          "host": "localhost",
          "port": 8000,
          "url": "http://localhost:8000"
        }
      ],
      "loadBalanceStrategy": "ROUND_ROBIN"
    }
  }
}
```

---

### **Load Balancer Strategies**

The **load balancer** determines which service instance receives the next request.

- **ROUND_ROBIN**: Requests are distributed sequentially among available instances.
- **LEAST_USED**: (Future implementation) Routes requests to the least-utilized instance.

---

### **Authentication Middleware**

The authentication middleware checks incoming requests for valid credentials (username and password). If the credentials are valid, the request is forwarded; otherwise, it returns an authentication error.

---

## 3. Gateway Server

The **Gateway Server** handles the following:

1. **Registering/Unregistering Services**
2. **Routing Requests to Backend Services**
3. **Enabling/Disabling Service Instances**
4. **Implementing Load Balancing**
5. **Authentication Middleware**

---

### Code Explanation

#### **Registration Route (`/register`)**

This route registers a service by adding it to the registry. The service information (name, host, port, etc.) is received via the request body and saved in `registry.json`.

```javascript
router.post("/register", (req, res) => {
  const registrationInfo = req.body;

  registrationInfo.url = `${registrationInfo.protocol}://${registrationInfo.host}:${registrationInfo.port}`;

  if (apiAlreadyExists(registrationInfo)) {
    return res.send(
      "Configuration already exists for " + registrationInfo.apiName
    );
  }

  registry.services[registrationInfo.apiName].instances.push({
    ...registrationInfo,
  });

  fs.writeFile("./routes/registry.json", JSON.stringify(registry), (error) => {
    if (error) res.send("could not register " + registrationInfo.apiName);
    else res.send("successfully registered " + registrationInfo.apiName);
  });
});
```

#### **Forwarding Requests to Services (`/:apiName/:path`)**

This route forwards incoming requests to the appropriate service instance. It selects the instance based on the configured **load balancing strategy**.

```javascript
router.all("/:apiName/:path", async (req, res) => {
  const service = registry.services[req.params.apiName];
  if (service) {
    try {
      const newIndex = loadbalancer[service.loadBalanceStrategy](service);
      const url = service.instances[newIndex].url;
      const response = await axios({
        method: req.method,
        url: `${url}/${req.params.path}`,
        headers: req.headers,
        data: req.body,
      });
      res.send(response.data);
    } catch (error) {
      res.status(500).send("Internal server error");
    }
  } else {
    res.status(404).send("API name doesn't exist");
  }
});
```

#### **Authentication Middleware (`auth`)**

This middleware decodes the **Authorization** header and verifies the username and password.

```javascript
const auth = (req, res, next) => {
  const authString = Buffer.from(req.headers.authorization, "base64").toString(
    "utf8"
  );
  const [username, password] = authString.split(":");
  const user = registry.auth.users[username];

  if (user && user.password === password) next();
  else
    res.send({ authenticated: false, message: "Authentication unsuccessful" });
};
```

---

## 4. Fake API Service

The **Fake API Service** runs on port 8000 and exposes two endpoints (`/fakeapi` and `/bogusapi`) for testing.

### Code Explanation

```javascript
const express = require("express");
const app = express();

app.use(express.json());

app.get("/fakeapi", (req, res) => {
  res.send("hello from fake server");
});

app.post("/bogusapi", (req, res) => {
  console.log("Received body:", req.body);
  res.send("bogus api says hello");
});

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
```

- **GET /fakeapi**: Returns a simple text message.
- **POST /bogusapi**: Logs the received body and returns a response.

---

## 5. How to Run

1. **Install Dependencies**  
   Make sure you have **Node.js** installed. Run the following command:

   ```bash
   npm install express axios helmet
   ```

2. **Start the Fake API Service**

   ```bash
   node fakeApi.js
   ```

3. **Start the Gateway Server**
   ```bash
   node gateway.js
   ```

---

## 6. API Endpoints

### **Gateway Server Endpoints**

- **POST /register**  
  Registers a new service.

- **POST /unregister**  
  Unregisters an existing service.

- **POST /enable/:apiName**  
  Enables or disables a specific instance of a service.

- **GET/POST /:apiName/:path**  
  Forwards requests to the registered service instance.

---

## 7. Example Requests and Responses

### **Registering a Service**

**Request:**

```bash
curl -X POST http://localhost:4000/register \
-H "Authorization: am9obmRvZTpwYXNzd29yZA==" \
-H "Content-Type: application/json" \
-d '{
  "apiName": "testapi",
  "protocol": "http",
  "host": "localhost",
  "port": 8000
}'
```

**Response:**

```
successfully registered testapi
```

### **Calling the Fake API via Gateway**

**Request:**

```bash
curl http://localhost:4000/testapi/fakeapi
```

**Response:**

```
hello from fake server
```

### **Enabling a Service Instance**

**Request:**

```bash
curl -X POST http://localhost:4000/enable/testapi \
-H "Authorization: am9obmRvZTpwYXNzd29yZA==" \
-H "Content-Type: application/json" \
-d '{
  "url": "http://localhost:8000",
  "enabled": true
}'
```

**Response:**

```
successfully enabled/disabled http://localhost:8000 for service testapi
```

---

## Conclusion

This setup demonstrates a basic **API Gateway** with service registration, load balancing, and authentication. The **Fake API Service** provides a simple backend for testing. You can expand this example by adding more services or implementing new load balancing strategies like **LEAST_USED**.
