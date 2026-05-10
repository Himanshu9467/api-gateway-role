const express = require("express");

const app = express();

app.get("/health", (req, res) => {
  res.json({
    service: "onboarding",
    status: "UP"
  });
});

app.listen(3002, () => {
  console.log("Onboarding service running on port 3002");
});