const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());

app.get("/fakeapi", (req, res, next) => {
  res.send("hello from fake server");
});

app.post("/bogusapi", (req, res, next) => {
  console.log("Received body:", req.body); // Log the incoming body
  res.send("bogus api says hello");
});

const PORT = 8000;
const HOST = "localhost";
// Start the server
app.listen(PORT, async () => {
  console.log(`Server is listening on port ${PORT}`);

  // Make the axios request after the server has started
  try {
    const response = await axios({
      method: "POST",
      url: "http://localhost:4000/register",
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        apiName: "testapi",
        protocol: "http",
        host: HOST,
        port: PORT,
        url: `${HOST}:${PORT}`,
      },
    });
    console.log("Service registered:", response.data);
  } catch (error) {
    console.error("Error registering service:", error.message);
  }
});
