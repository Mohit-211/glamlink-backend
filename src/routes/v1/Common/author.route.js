/** @format */

const express = require("express");
const router = express.Router();

const { authorController } = require("../../../controllers");

router.post("/", authorController.createAuthor);
router.get("/", authorController.getAllAuthors);
router.get("/:id", authorController.findAuthorById);
router.put("/:id", authorController.updateAuthor);
router.post("/delete", authorController.deleteAuthor);

module.exports = router;
