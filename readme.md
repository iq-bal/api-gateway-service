# Documentation for Gateway Server and Fake API Service

## Table of Contents

1. [Overview](#1-overview)
2. [Concepts](#2-concepts)
   - [API Gateway](#api-gateway)
   - [Service Registry](#service-registry)
   - [Load Balancer Strategies](#load-balancer-strategies)
   - [Authentication Middleware](#authentication-middleware)
3. [Gateway Server](#3-gateway-server)
   - [How it Works](#how-it-works)
   - [Code Explanation](#code-explanation)
4. [Fake API Service](#4-fake-api-service)
   - [How it Works](#how-it-works-1)
   - [Code Explanation](#code-explanation-1)
5. [How to Run](#5-how-to-run)
6. [API Endpoints](#6-api-endpoints)
7. [Example Requests and Responses](#7-example-requests-and-responses)

---

## 1. Overview

The setup consists of:

1. **Gateway Server**: Acts as a reverse proxy, routing requests to backend services with features like load balancing, service enabling/disabling, and authentication.
2. **Fake API Service**: A mock service running on port `8000` to test communication with the gateway.

---

## 2. Concepts

### API Gateway

An **API Gateway** serves as a centralized entry point for backend services. It forwards requests to the appropriate service and returns the response to the client. In this project, the gateway performs:

- **Routing**: Directs requests to the correct service.
- **Load Balancing**: Distributes traffic among instances.
- **Authentication**: Ensures only authorized access to services.

---

### Service Registry

A **Service Registry** holds metadata for registered services, like their name, protocol, host, and port. It is saved in `registry.json`.

Example of `registry.json`:

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

### Load Balancer Strategies

- **ROUND_ROBIN**: Distributes requests sequentially among instances.
- **LEAST_USED**: (Future implementation) Routes traffic to the least-utilized instance.

---

### Authentication Middleware

The middleware checks the **Authorization** header and verifies the provided credentials (username/password). Valid requests are forwarded, while invalid ones return an error.

---

## 3. Gateway Server

The **Gateway Server** handles:

1. **Service Registration/Unregistration**
2. **Routing Requests**
3. **Service Enabling/Disabling**
4. **Load Balancing**
5. **Authentication**

---

### How it Works

- **Registration Route**: Adds new services to the registry.
- **Routing Requests**: Forwards requests to appropriate service instances.
- **Load Balancing**: Uses the selected strategy to manage traffic.
- **Authentication Middleware**: Secures endpoints with basic authentication.

---

### Code Explanation

#### **Service Registration (`/register`)**

Registers a service by adding it to `registry.json`.

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

Forwards incoming requests to the correct service instance using load balancing.

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

Verifies credentials sent in the **Authorization** header.

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

A mock service running on port `8000` with simple endpoints for testing.

---

### How it Works

- **GET /fakeapi**: Returns a greeting message.
- **POST /bogusapi**: Logs and returns a response with the request body.

---

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

---

## 5. How to Run

1. **Install Dependencies**:

   ```bash
   npm install express axios helmet
   ```

2. **Start the Fake API Service**:

   ```bash
   node fakeApi.js
   ```

3. **Start the Gateway Server**:
   ```bash
   node gateway.js
   ```

---

## 6. API Endpoints

### Gateway Server Endpoints

- **POST /register**: Registers a new service.
- **POST /unregister**: Unregisters an existing service.
- **POST /enable/:apiName**: Enables/disables a service instance.
- **GET/POST /:apiName/:path**: Forwards requests to the correct instance.

---

## 7. Example Requests and Responses

### **Registering a Service**

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

```bash
curl http://localhost:4000/testapi/fakeapi
```

**Response:**

```
hello from fake server
```

### **Enabling a Service Instance**

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

This setup demonstrates a basic **API Gateway** with features like service registration, load balancing, and authentication. The **Fake API Service** provides a simple backend for testing. You can expand this project by adding more services or implementing additional load balancing strategies like **LEAST_USED**.

---

This `README.md` will now provide clear and structured documentation for your project. Save this file in the **root** of your project.
