const express = require("express");

const app = express();

app.get("/health", (req, res) => {
  res.json({
    service: "data-room",
    status: "UP"
  });
});

app.listen(3001, () => {
  console.log("Data-room service running on port 3001");
});