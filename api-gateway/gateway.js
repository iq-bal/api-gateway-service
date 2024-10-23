const express = require("express");
const helmet = require("helmet");
const app = express();
const routes = require("./routes");

app.use(express.json());
app.use(helmet());
app.use(express.urlencoded({ extended: true })); // For URL-encoded bodies

app.use("/", routes);

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
